// Public service rules: validation, parent department must exist, unique code, delete protection,
// and catalog change events (topic woreda.catalog).
import { ConflictError, NotFoundError, ValidationError, isDuplicateKey } from "../utils/errors.js";
import { newId } from "../utils/id.js";
import * as departments from "../repositories/department.repository.js";
import * as publicServices from "../repositories/publicService.repository.js";

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
const int = (v) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : 0);

export function validatePublicService(input) {
  const f = {
    departmentId: str(input.departmentId),
    name: str(input.name).trim(),
    code: str(input.code).trim().toUpperCase(),
    description: str(input.description),
    durationMinutes: int(input.durationMinutes) || 30,
    dailyQuota: int(input.dailyQuota) || 40,
    feeETB: Number(input.feeETB) || 0,
    processingDays: str(input.processingDays) || "Same day",
    requiredDocuments: Array.isArray(input.requiredDocuments) ? input.requiredDocuments.map(str) : [],
  };
  const v = new ValidationError();
  if (!f.departmentId) v.add("departmentId", "Parent department is required.");
  if (!f.name) v.add("name", "Service name is required.");
  if (!f.code) v.add("code", "Service code is required.");
  if (f.durationMinutes < 0 || f.dailyQuota < 0) v.add("durationMinutes", "Duration and daily quota must be positive.");
  if (f.feeETB < 0) v.add("feeETB", "Fee cannot be negative.");
  v.throwIfAny();
  return f;
}

export function createPublicServiceService({ events }) {
  async function requireDepartment(departmentId) {
    if (!(await departments.exists(departmentId))) {
      new ValidationError().add("departmentId", "Parent department does not exist.").throwIfAny();
    }
  }

  const duplicateCode = (code) => (err) => {
    throw isDuplicateKey(err) ? new ConflictError(`service code ${code} already exists`) : err;
  };

  const service = {
    list(filter) {
      return publicServices.findAll(filter);
    },

    async get(id) {
      const s = await publicServices.findById(id);
      if (!s) throw new NotFoundError();
      return s;
    },

    async create(input) {
      const fields = validatePublicService(input);
      await requireDepartment(fields.departmentId);
      const id = newId("srv");
      await publicServices.create({ _id: id, ...fields }).catch(duplicateCode(fields.code));
      const s = await service.get(id);
      events.publish("catalog.service.created", id, s.toJSON());
      return s;
    },

    async update(id, input) {
      const fields = validatePublicService(input);
      await requireDepartment(fields.departmentId);
      const found = await publicServices.update(id, fields).catch(duplicateCode(fields.code));
      if (!found) throw new NotFoundError();
      const s = await service.get(id);
      events.publish("catalog.service.updated", id, s.toJSON());
      return s;
    },

    async toggle(id) {
      const isActive = await publicServices.toggleActive(id);
      if (isActive === null) throw new NotFoundError();
      events.publish("catalog.service.status_changed", id, { isActive });
      return isActive;
    },

    async remove(id) {
      if (await publicServices.hasAppointments(id)) {
        throw new ConflictError("service has appointments; deactivate it instead");
      }
      if (!(await publicServices.remove(id))) throw new NotFoundError();
      await publicServices.clearFromSchedules(id);
      events.publish("catalog.service.deleted", id, null);
    },
  };
  return service;
}
