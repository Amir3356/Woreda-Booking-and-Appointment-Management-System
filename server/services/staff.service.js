// Staff accounts (Admin > Users): role labels, department existence, unique email,
// paged listing with department names.
import bcrypt from "bcryptjs";
import { ConflictError, NotFoundError, ValidationError, isDuplicateKey } from "../utils/errors.js";
import { cursorMeta } from "../utils/pagination.js";
import { newId } from "../utils/id.js";
import { roleLabel } from "../models/user.model.js";
import * as users from "../repositories/user.repository.js";
import * as departments from "../repositories/department.repository.js";
import * as publicServices from "../repositories/publicService.repository.js";

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

/**
 * A department officer works on the public services assigned to them; without any they could not
 * see or decide a single appointment. So an officer needs at least one service, each an existing
 * service of the officer's own department. On update an absent list keeps the current assignment.
 */
async function checkOfficerServices(req, { required }) {
  if (req.role !== "OFFICER") return;
  if (req.serviceIds === undefined && !required) return;
  const ids = [...new Set(req.serviceIds ?? [])];
  const v = new ValidationError();
  if (ids.length === 0) {
    v.add("serviceIds", "Assign at least one public service to the department officer.");
  } else {
    for (const id of ids) {
      const service = await publicServices.findById(id);
      if (!service) v.add("serviceIds", `Service ${id} does not exist.`);
      else if (service.departmentId !== req.departmentId) {
        v.add("serviceIds", `Service "${service.name}" does not belong to the officer's department.`);
      }
    }
  }
  v.throwIfAny();
}

function parseStaffServices(address) {
  if (!address) return [];
  try {
    const parsed = JSON.parse(address);
    if (Array.isArray(parsed?.serviceIds)) return parsed.serviceIds;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return [];
  }
  return [];
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
          serviceIds: parseStaffServices(u.address),
          isActive: u.isActive,
          createdAt: u.createdAt,
        })),
        cursor: cursorMeta(cursor, pageSize, total),
      };
    },

    /** Validated query in; {items, cursor, totalRegistered, filters} of registered citizens out. Scoped to officer's assigned department and services. */
    async listCitizens(callerOrOpts, maybeOpts) {
      const caller = maybeOpts !== undefined ? callerOrOpts : null;
      const opts = maybeOpts !== undefined ? maybeOpts : callerOrOpts || {};
      const { search = "", woreda = "", kebele = "", location = "", cursor = 0, pageSize = 5 } = opts;

      const isOfficer = caller?.role === "OFFICER";
      let departmentId = isOfficer ? (caller.departmentId || null) : null;
      let serviceIds = null;
      if (isOfficer) {
        if (Array.isArray(caller.serviceIds) && caller.serviceIds.length > 0) {
          serviceIds = caller.serviceIds;
        }
        if ((!departmentId || !serviceIds) && caller.userId) {
          const u = await users.findById(caller.userId);
          if (u) {
            if (!departmentId && u.departmentId) departmentId = u.departmentId;
            if (!serviceIds && u.address) {
              try {
                const parsed = JSON.parse(u.address);
                if (Array.isArray(parsed?.serviceIds)) serviceIds = parsed.serviceIds;
                else if (Array.isArray(parsed)) serviceIds = parsed;
              } catch {}
            }
          }
        }
      }

      const { total, totalRegistered, addresses, items } = await users.findCitizenPage({
        search,
        woreda,
        kebele,
        location,
        offset: cursor,
        limit: pageSize,
        departmentId,
        serviceIds,
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
            email: u.email,
            nationalId: u.nationalId,
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
      if (req.departmentId !== null && req.departmentId !== undefined && !(await departments.exists(req.departmentId))) {
        throw new ValidationError().add("departmentId", "Department does not exist.");
      }
      await checkOfficerServices(req, { required: true });
      const id = newId("usr");
      const phoneVal = req.phone || "";
      const emailVal = req.email || (phoneVal ? `${phoneVal.replace(/\D/g, "")}@woreda.gov.et` : "");
      const addressVal = req.serviceIds && req.serviceIds.length > 0 ? JSON.stringify({ serviceIds: req.serviceIds }) : null;
      await users
        .create({
          id, fullName: req.fullName, email: emailVal, phone: phoneVal, passwordHash: await bcrypt.hash(req.password, BCRYPT_COST),
          nationalId: `ET-EMP-${id.slice(4)}`, role: req.role, departmentId: req.departmentId,
          counterNumber: null, address: addressVal, isActive: true,
        })
        .catch((err) => {
          throw isDuplicateKey(err) ? new ConflictError("phone, email or national ID already registered") : err;
        });
      events?.publish("staff.created", id, {
        id,
        fullName: req.fullName,
        email: emailVal,
        phone: phoneVal,
        role: roleLabel(req.role),
        roleCode: req.role,
        departmentId: req.departmentId,
        serviceIds: req.serviceIds || [],
        isActive: true,
      });
      return id;
    },

    /** Updates a staff account; returns updated summary. */
    async update(id, req) {
      if (req.departmentId !== null && req.departmentId !== undefined && !(await departments.exists(req.departmentId))) {
        throw new ValidationError().add("departmentId", "Department does not exist.");
      }
      await checkOfficerServices(req, { required: false });
      const phoneVal = req.phone || "";
      const emailVal = req.email || (phoneVal ? `${phoneVal.replace(/\D/g, "")}@woreda.gov.et` : "");
      const passwordHash = req.password ? await bcrypt.hash(req.password, BCRYPT_COST) : null;
      const addressVal = req.serviceIds !== undefined ? (req.serviceIds && req.serviceIds.length > 0 ? JSON.stringify({ serviceIds: req.serviceIds }) : null) : undefined;
      const updated = await users
        .updateStaff(id, {
          fullName: req.fullName,
          phone: phoneVal,
          email: emailVal,
          passwordHash,
          role: req.role,
          departmentId: req.departmentId,
          ...(addressVal !== undefined ? { address: addressVal } : {}),
        })
        .catch((err) => {
          throw isDuplicateKey(err) ? new ConflictError("phone or email already registered") : err;
        });
      if (!updated) throw new NotFoundError();
      const u = await users.findById(id);
      const staffSummary = {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: roleLabel(u.role),
        roleCode: u.role,
        departmentId: u.departmentId,
        departmentName: u.departmentName,
        serviceIds: parseStaffServices(u.address),
        isActive: u.isActive,
        createdAt: u.createdAt,
      };
      events?.publish("staff.updated", id, staffSummary);
      return staffSummary;
    },

    async toggleStatus(id) {
      const isActive = await users.toggleStaffActive(id);
      if (isActive === null) throw new NotFoundError();
      events?.publish("staff.status_changed", id, { id, isActive });
      return isActive;
    },

    async remove(id) {
      if (!(await users.removeStaff(id))) throw new NotFoundError();
      events?.publish("staff.deleted", id, { id });
    },
  };
}
