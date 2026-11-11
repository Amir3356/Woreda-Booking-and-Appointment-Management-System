// Operating schedules (Admin > Schedule Management): referenced department and service
// must exist, the client's status labels, and change events so open booking pages re-read them.
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { today } from "../utils/date.js";
import { cursorMeta } from "../utils/pagination.js";
import { statusLabel } from "../models/schedule.model.js";
import * as schedules from "../repositories/schedule.repository.js";
import * as departments from "../repositories/department.repository.js";
import * as publicServices from "../repositories/publicService.repository.js";

const labelled = (s) => ({ ...s, status: statusLabel(s.status) });

export function createScheduleService({ events }) {
  async function checkReferences(fields) {
    const v = new ValidationError();
    // departmentId null = the Woreda-wide schedule shared by every department.
    if (fields.departmentId !== null && !(await departments.exists(fields.departmentId))) v.add("departmentId", "Department does not exist.");
    if (fields.departmentId === null && fields.serviceId !== null) v.add("serviceId", "A service schedule needs the service's department.");
    if (fields.serviceId !== null && !(await publicServices.exists(fields.serviceId))) v.add("serviceId", "Service does not exist.");
    v.throwIfAny();
  }

  async function get(id) {
    const s = await schedules.findById(id);
    if (!s) throw new NotFoundError();
    return labelled(s);
  }

  return {
    /** Every schedule for the administrator; a department officer sees only their department's (read-only). */
    async list(caller) {
      if (caller?.role && caller.role !== "ADMIN") {
        if (!caller.departmentId) return [];
        return (await schedules.findByDepartment(caller.departmentId)).map(labelled);
      }
      return (await schedules.findAll()).map(labelled);
    },

    /** Cursor-paged schedule list for the admin/staff working-hours table. */
    async listPaged(caller, { search = "", status = "", cursor = 0, pageSize = 5 } = {}) {
      const isOfficer = caller?.role && caller.role !== "ADMIN";
      if (isOfficer && !caller.departmentId) {
        return { items: [], cursor: cursorMeta(cursor, pageSize, 0) };
      }
      const { total, items } = await schedules.findPage({
        departmentId: isOfficer ? caller.departmentId : undefined,
        search,
        status,
        offset: cursor,
        limit: pageSize,
      });
      return {
        items: items.map(labelled),
        cursor: cursorMeta(cursor, pageSize, total),
      };
    },

    /** Public: ACTIVE schedules not yet ended, for the citizen booking page. */
    async listBookable() {
      return (await schedules.findBookable(today())).map(labelled);
    },

    /** fields: validated body (validations/schedule.validation.js). */
    async create(fields) {
      await checkReferences(fields);
      const id = newId("SCH");
      await schedules.create({ id, ...fields, status: fields.status ?? "ACTIVE" });
      const created = await get(id);
      events.publish("catalog.schedule.created", id, created);
      return created;
    },

    async update(id, fields) {
      await checkReferences(fields);
      if (!(await schedules.update(id, fields))) throw new NotFoundError();
      const updated = await get(id);
      events.publish("catalog.schedule.updated", id, updated);
      return updated;
    },

    async toggle(id) {
      const status = await schedules.toggleStatus(id);
      if (status === null) throw new NotFoundError();
      events.publish("catalog.schedule.status_changed", id, { status: statusLabel(status) });
      return { id, status: statusLabel(status) };
    },

    async remove(id) {
      if (!(await schedules.remove(id))) throw new NotFoundError();
      events.publish("catalog.schedule.deleted", id, null);
    },
  };
}
