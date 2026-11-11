// Operating schedules (Admin > Schedule Management): referenced department and service
// must exist, the client's status labels, and change events so open booking pages re-read them.
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { today } from "../utils/date.js";
import { statusLabel } from "../models/schedule.model.js";
import * as schedules from "../repositories/schedule.repository.js";
import * as departments from "../repositories/department.repository.js";
import * as publicServices from "../repositories/publicService.repository.js";

const labelled = (s) => ({ ...s, status: statusLabel(s.status) });

export function createScheduleService({ events }) {
  async function checkReferences(fields) {
    const v = new ValidationError();
    if (!(await departments.exists(fields.departmentId))) v.add("departmentId", "Department does not exist.");
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
