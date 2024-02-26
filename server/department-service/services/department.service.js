// Department rules: validation, uniqueness, delete protection, and catalog change events.
import { ConflictError, NotFoundError, ValidationError, isDuplicateKey } from "../utils/errors.js";
import { newId } from "../utils/id.js";
import * as departments from "../repositories/department.repository.js";
import * as publicServices from "../repositories/publicService.repository.js";

const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));

export function validateDepartment(input) {
  const f = {
    name: str(input.name).trim(),
    code: str(input.code).trim().toUpperCase(),
    description: str(input.description),
    buildingRoom: str(input.buildingRoom),
    contactPhone: str(input.contactPhone),
  };
  const v = new ValidationError();
  if (!f.name) v.add("name", "Department name is required.");
  if (!f.code || f.code.length > 16) v.add("code", "Code is required (max 16 characters).");
  if (!f.buildingRoom.trim()) v.add("buildingRoom", "Building/room is required.");
  if (!f.contactPhone.trim()) v.add("contactPhone", "Contact phone is required.");
  v.throwIfAny();
  return f;
}

export function createDepartmentService({ events }) {
  /** Adds officerCount and serviceCount to each department. */
  async function withCounts(list) {
    const { officers, services } = await departments.countsFor(list.map((d) => d._id));
    return list.map((d) => ({ ...d.toJSON(), officerCount: officers.get(d._id) ?? 0, serviceCount: services.get(d._id) ?? 0 }));
  }

  const duplicateCode = (code) => (err) => {
    throw isDuplicateKey(err) ? new ConflictError(`department code ${code} already exists`) : err;
  };

  const service = {
    async list(isActive) {
      return withCounts(await departments.findAll(isActive));
    },

    async get(id) {
      const d = await departments.findById(id);
      if (!d) throw new NotFoundError();
      return (await withCounts([d]))[0];
    },

    async create(input) {
      const fields = validateDepartment(input);
      const id = newId("dept");
      await departments.create({ _id: id, ...fields }).catch(duplicateCode(fields.code));
      const d = await service.get(id);
      events.publish("catalog.department.created", id, d);
      return d;
    },

    async update(id, input) {
      const fields = validateDepartment(input);
      const found = await departments.update(id, fields).catch(duplicateCode(fields.code));
      if (!found) throw new NotFoundError();
      const d = await service.get(id);
      events.publish("catalog.department.updated", id, d);
      return d;
    },

    async toggle(id) {
      const isActive = await departments.toggleActive(id);
      if (isActive === null) throw new NotFoundError();
      events.publish("catalog.department.status_changed", id, { isActive });
      return isActive;
    },

    async remove(id) {
      if (await publicServices.existsInDepartment(id)) {
        throw new ConflictError("department still has services; delete or move them first");
      }
      if (!(await departments.remove(id))) throw new NotFoundError();
      await departments.clearFromUsers(id);
      events.publish("catalog.department.deleted", id, null);
    },
  };
  return service;
}
