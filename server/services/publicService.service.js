// Public services (the catalog citizens book from): parent department must exist,
// unique code, delete protection, and catalog change events.
import { ConflictError, NotFoundError, invalid, isDuplicateKey } from "../utils/errors.js";
import { cursorMeta } from "../utils/pagination.js";
import { newId } from "../utils/id.js";
import * as departments from "../repositories/department.repository.js";
import * as publicServices from "../repositories/publicService.repository.js";

export function createPublicServiceService({ events }) {
  async function requireDepartment(departmentId) {
    if (!(await departments.exists(departmentId))) invalid("departmentId", "Parent department does not exist.");
  }

  const duplicateCode = (code) => (err) => {
    throw isDuplicateKey(err) ? new ConflictError(`service code ${code} already exists`) : err;
  };

  const service = {
    list(filter) {
      return publicServices.findAll(filter);
    },

    async listPaged({ isActive, departmentId, serviceId, search = "", cursor = 0, pageSize = 4 }) {
      const { total, items } = await publicServices.findPage({
        isActive,
        departmentId,
        serviceId,
        search,
        offset: cursor,
        limit: pageSize,
      });
      return {
        items,
        cursor: cursorMeta(cursor, pageSize, total),
      };
    },

    async get(id) {
      const s = await publicServices.findById(id);
      if (!s) throw new NotFoundError();
      return s;
    },

    /** fields: validated body (validations/catalog.validation.js). */
    async create(fields) {
      if (fields.departmentId) await requireDepartment(fields.departmentId);
      const id = newId("srv");
      await publicServices.create({ id, ...fields }).catch(duplicateCode(fields.code));
      const s = await service.get(id);
      events.publish("catalog.service.created", id, s);
      return s;
    },

    async update(id, fields) {
      if (fields.departmentId) await requireDepartment(fields.departmentId);
      const found = await publicServices.update(id, fields).catch(duplicateCode(fields.code));
      if (!found) throw new NotFoundError();
      const s = await service.get(id);
      events.publish("catalog.service.updated", id, s);
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
      events.publish("catalog.service.deleted", id, null);
    },
  };
  return service;
}
