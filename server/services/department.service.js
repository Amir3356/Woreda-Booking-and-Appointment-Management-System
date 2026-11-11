// Departments: unique code, delete protection, and catalog change events.
import { ConflictError, NotFoundError, isDuplicateKey } from "../utils/errors.js";
import { newId } from "../utils/id.js";
import * as departments from "../repositories/department.repository.js";
import * as publicServices from "../repositories/publicService.repository.js";

export function createDepartmentService({ events }) {
  const duplicateCode = (code) => (err) => {
    throw isDuplicateKey(err) ? new ConflictError(`department code ${code} already exists`) : err;
  };

  const service = {
    list(isActive) {
      return departments.findAll(isActive);
    },

    async get(id) {
      const d = await departments.findById(id);
      if (!d) throw new NotFoundError();
      return d;
    },

    /** fields: validated body (validations/catalog.validation.js). */
    async create(fields) {
      const { serviceIds, ...deptFields } = fields;
      const id = newId("dept");
      await departments.create({ id, ...deptFields }).catch(duplicateCode(fields.code));
      if (serviceIds?.length) {
        await publicServices.assignToDepartment(id, serviceIds);
      }
      const d = await service.get(id);
      events.publish("catalog.department.created", id, d);
      if (serviceIds?.length) {
        events.publish("catalog.changed", id, null);
      }
      return d;
    },

    async update(id, fields) {
      const { serviceIds, ...deptFields } = fields;
      const found = await departments.update(id, deptFields).catch(duplicateCode(fields.code));
      if (!found) throw new NotFoundError();
      if (serviceIds !== undefined) {
        await publicServices.unassignFromDepartment(id, serviceIds);
        if (serviceIds.length) {
          await publicServices.assignToDepartment(id, serviceIds);
        }
      }
      const d = await service.get(id);
      events.publish("catalog.department.updated", id, d);
      events.publish("catalog.changed", id, null);
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
      events.publish("catalog.department.deleted", id, null);
    },
  };
  return service;
}
