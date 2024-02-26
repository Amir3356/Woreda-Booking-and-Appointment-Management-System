// Staff account rules: provisioning validation, role labels, department existence, unique email,
// paged listing with department names.
import bcrypt from "bcryptjs";
import { ConflictError, NotFoundError, ValidationError, isDuplicateKey } from "../utils/errors.js";
import { byteLen, decodeStruct } from "../utils/decode.js";
import { cursorMeta, pageParams } from "../utils/pagination.js";
import { newId } from "../utils/id.js";
import * as users from "../repositories/user.repository.js";
import * as departments from "../repositories/department.repository.js";

export const LABEL_OFFICER = "Department Officer";
export const LABEL_ADMIN = "Central Administrator";

const BCRYPT_COST = 10; // bcrypt.DefaultCost
const DUPLICATE = "email or national ID already registered";

// RFC 5322 addr-spec as Go's net/mail accepts it (dot-atom or quoted local part, UTF-8 allowed).
const ATEXT = "[A-Za-z0-9!#$%&'*+\\-/=?^_`{|}~\\u0080-\\uFFFF]";
const DOT_ATOM = `${ATEXT}+(?:\\.${ATEXT}+)*`;
const QUOTED = '"(?:[^"\\\\\\r\\n]|\\\\.)*"';
const EMAIL = new RegExp(`^(?:${DOT_ATOM}|${QUOTED})@(?:${DOT_ATOM}|\\[[^\\[\\]\\\\]*\\])$`);

export function isValidEmail(email) {
  const e = String(email).trim();
  if (e === "" || byteLen(e) > 254) return false;
  // mail.ParseAddress(e).Address == e: a bare addr-spec, no display name or comments.
  return EMAIL.test(e);
}

export function roleLabel(role) {
  if (role === "OFFICER") return LABEL_OFFICER;
  if (role === "ADMIN") return LABEL_ADMIN;
  return role;
}

export const decodeProvision = (input) =>
  decodeStruct(input, "ProvisionRequest", { fullName: "string", email: "string", password: "string", role: "string", departmentId: "string" });

/** Validates a provisioning request; returns {fullName, email, password, role, departmentId|null}. */
export function validateProvision(req) {
  const v = new ValidationError();
  let role = null;
  if (req.role === LABEL_OFFICER || req.role === "OFFICER") role = "OFFICER";
  else if (req.role === LABEL_ADMIN || req.role === "ADMIN") role = "ADMIN";
  else v.add("role", 'Role must be "Department Officer" or "Central Administrator".');
  if (byteLen(req.fullName.trim()) < 3) v.add("fullName", "Full name is required (min 3 characters).");
  if (!isValidEmail(req.email)) v.add("email", "A valid email address is required.");
  if (byteLen(req.password) < 8) v.add("password", "Password must be at least 8 characters.");
  let departmentId = null;
  if (req.departmentId !== "") departmentId = req.departmentId;
  else if (role === "OFFICER") v.add("departmentId", "Officers must be assigned to a department.");
  v.throwIfAny();
  return { fullName: req.fullName.trim(), email: req.email.trim(), password: req.password, role, departmentId };
}

export function createStaffService() {
  return {
    /** Raw query values in; {items, cursor} out (cursor is the paging meta). */
    async list(search, cursorRaw, pageSizeRaw) {
      const { cursor, pageSize } = pageParams(cursorRaw, pageSizeRaw);
      const { total, rows } = await users.findStaffPage(String(search ?? "").trim(), cursor, pageSize);
      const names = await departments.namesFor([...new Set(rows.map((r) => r.departmentId).filter(Boolean))]);
      const items = rows.map((r) => ({
        id: r._id,
        fullName: r.fullName,
        email: r.email,
        role: roleLabel(r.role),
        departmentId: r.departmentId ?? null,
        departmentName: r.departmentId ? (names.get(r.departmentId) ?? null) : null,
        isActive: r.isActive,
      }));
      return { items, cursor: cursorMeta(cursor, pageSize, total) };
    },

    /** input: the JSON request body. Returns the new account id. */
    async provision(input) {
      const req = validateProvision(decodeProvision(input));
      // Was a foreign key to departments(id).
      if (req.departmentId !== null && !(await departments.exists(req.departmentId))) {
        throw new ValidationError().add("departmentId", "Department does not exist.");
      }
      const hash = await bcrypt.hash(req.password, BCRYPT_COST);
      const id = newId("usr");
      await users
        .create({
          _id: id, fullName: req.fullName, email: req.email, phone: "", passwordHash: hash,
          nationalId: `ET-EMP-${id.slice(4)}`, role: req.role, departmentId: req.departmentId,
          counterNumber: null, address: null, isActive: true,
        })
        .catch((err) => {
          throw isDuplicateKey(err) ? new ConflictError(DUPLICATE) : err;
        });
      return id;
    },

    async toggleStatus(id) {
      const isActive = await users.toggleStaffActive(id);
      if (isActive === null) throw new NotFoundError();
      return isActive;
    },

    async remove(id) {
      if (!(await users.removeStaff(id))) throw new NotFoundError();
    },
  };
}
