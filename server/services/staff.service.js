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

export function createStaffService() {
  return {
    /** Validated query in; {items, cursor} out (cursor is the paging meta). */
    async list({ search, cursor, pageSize }) {
      const { total, items } = await users.findStaffPage(search, cursor, pageSize);
      return {
        items: items.map((u) => ({
          id: u.id, fullName: u.fullName, email: u.email, role: roleLabel(u.role),
          departmentId: u.departmentId, departmentName: u.departmentName, isActive: u.isActive,
        })),
        cursor: cursorMeta(cursor, pageSize, total),
      };
    },

    /** req: validated body (role already "OFFICER" | "ADMIN"). Returns the new account id. */
    async provision(req) {
      if (req.departmentId !== null && !(await departments.exists(req.departmentId))) {
        throw new ValidationError().add("departmentId", "Department does not exist.");
      }
      const id = newId("usr");
      await users
        .create({
          id, fullName: req.fullName, email: req.email, phone: "", passwordHash: await bcrypt.hash(req.password, BCRYPT_COST),
          nationalId: `ET-EMP-${id.slice(4)}`, role: req.role, departmentId: req.departmentId,
          counterNumber: null, address: null, isActive: true,
        })
        .catch((err) => {
          throw isDuplicateKey(err) ? new ConflictError("email or national ID already registered") : err;
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
