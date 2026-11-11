// Staff accounts (Admin > Users): role labels, department existence, unique email,
// paged listing with department names.
import bcrypt from "bcryptjs";
import { ConflictError, NotFoundError, ValidationError, isDuplicateKey } from "../utils/errors.js";
import { cursorMeta } from "../utils/pagination.js";
import { newId } from "../utils/id.js";
import { roleLabel } from "../models/user.model.js";
import * as users from "../repositories/user.repository.js";
import * as departments from "../repositories/department.repository.js";

const BCRYPT_COST = 10;

function parseCitizenAddress(address) {
  const parts = (address || "").split(",").map((s) => s.trim()).filter(Boolean);
  const kebele = parts.find((p) => p.toLowerCase().startsWith("kebele")) || "Kebele 03";
  const woreda = parts.find((p) => p.toLowerCase().startsWith("woreda")) || "Woreda 03";
  const location =
    parts
      .filter(
        (p) =>
          !p.toLowerCase().startsWith("kebele") &&
          !p.toLowerCase().startsWith("woreda") &&
          !p.toLowerCase().startsWith("house"),
      )
      .join(", ") || "Addis Ababa";
  return { kebele, woreda, location };
}

export function createStaffService({ events } = {}) {
  return {
    /** Validated query in; {items, cursor} out (cursor is the paging meta). */
    async list({ search = "", role = "", departmentId = "", cursor = 0, pageSize = 4 } = {}) {
      const { total, items } = await users.findStaffPage({ search, role, departmentId, offset: cursor, limit: pageSize });
      return {
        items: items.map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone,
          role: roleLabel(u.role),
          roleCode: u.role,
          departmentId: u.departmentId,
          departmentName: u.departmentName,
          isActive: u.isActive,
          createdAt: u.createdAt,
        })),
        cursor: cursorMeta(cursor, pageSize, total),
      };
    },

    /** Validated query in; {items, cursor, totalRegistered, filters} of registered citizens out. */
    async listCitizens({ search = "", woreda = "", kebele = "", location = "", cursor = 0, pageSize = 5 }) {
      const { total, totalRegistered, addresses, items } = await users.findCitizenPage({
        search,
        woreda,
        kebele,
        location,
        offset: cursor,
        limit: pageSize,
      });

      const parsedAddresses = addresses.map(parseCitizenAddress);
      const woredas = Array.from(new Set(parsedAddresses.map((a) => a.woreda))).sort();
      const kebelesByWoreda = parsedAddresses.filter(
        (a) => !woreda || woreda === "ALL" || a.woreda.toLowerCase() === woreda.toLowerCase(),
      );
      const kebeles = Array.from(new Set(kebelesByWoreda.map((a) => a.kebele))).sort();
      const locations = Array.from(new Set(parsedAddresses.map((a) => a.location))).sort();

      return {
        items: items.map((u) => {
          const parsed = parseCitizenAddress(u.address);
          return {
            id: u.id,
            fullName: u.fullName,
            phone: u.phone,
            locations: parsed.location,
            woreda: parsed.woreda,
            kebele: parsed.kebele,
            isActive: u.isActive,
            createdAt: u.createdAt,
          };
        }),
        cursor: cursorMeta(cursor, pageSize, total),
        totalRegistered,
        filters: { woredas, kebeles, locations },
      };
    },

    /** req: validated body (role already "OFFICER" | "ADMIN"). Returns the new account id. */
    async provision(req) {
      if (req.departmentId !== null && !(await departments.exists(req.departmentId))) {
        throw new ValidationError().add("departmentId", "Department does not exist.");
      }
      const id = newId("usr");
      const phoneVal = req.phone || "";
      const emailVal = req.email || (phoneVal ? `${phoneVal.replace(/\D/g, "")}@woreda.gov.et` : "");
      await users
        .create({
          id, fullName: req.fullName, email: emailVal, phone: phoneVal, passwordHash: await bcrypt.hash(req.password, BCRYPT_COST),
          nationalId: `ET-EMP-${id.slice(4)}`, role: req.role, departmentId: req.departmentId,
          counterNumber: null, address: null, isActive: true,
        })
        .catch((err) => {
          throw isDuplicateKey(err) ? new ConflictError("phone, email or national ID already registered") : err;
        });
      events?.publish("staff.created", id, null);
      return id;
    },

    /** Updates a staff account; returns updated summary. */
    async update(id, req) {
      if (req.departmentId !== null && !(await departments.exists(req.departmentId))) {
        throw new ValidationError().add("departmentId", "Department does not exist.");
      }
      const phoneVal = req.phone || "";
      const emailVal = req.email || (phoneVal ? `${phoneVal.replace(/\D/g, "")}@woreda.gov.et` : "");
      const passwordHash = req.password ? await bcrypt.hash(req.password, BCRYPT_COST) : null;
      const updated = await users
        .updateStaff(id, {
          fullName: req.fullName,
          phone: phoneVal,
          email: emailVal,
          passwordHash,
          role: req.role,
          departmentId: req.departmentId,
        })
        .catch((err) => {
          throw isDuplicateKey(err) ? new ConflictError("phone or email already registered") : err;
        });
      if (!updated) throw new NotFoundError();
      events?.publish("staff.updated", id, null);
      const u = await users.findById(id);
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: roleLabel(u.role),
        roleCode: u.role,
        departmentId: u.departmentId,
        departmentName: u.departmentName,
        isActive: u.isActive,
        createdAt: u.createdAt,
      };
    },

    async toggleStatus(id) {
      const isActive = await users.toggleStaffActive(id);
      if (isActive === null) throw new NotFoundError();
      events?.publish("staff.status_changed", id, null);
      return isActive;
    },

    async remove(id) {
      if (!(await users.removeStaff(id))) throw new NotFoundError();
      events?.publish("staff.deleted", id, null);
    },
  };
}
