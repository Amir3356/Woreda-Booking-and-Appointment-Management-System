// Operating schedule rules (Go service/schedule_service.go): validation, referenced department and
// service must exist, the client's status labels, and change events (topic woreda.catalog) so open
// booking pages re-read the schedules and slot availability.
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { WEEKDAYS, hhmm, parseClock, parseDate, today } from "../utils/time.js";
import { decodeSchedule } from "../utils/decode.js";
import * as schedules from "../repositories/schedule.repository.js";
import * as catalog from "../repositories/catalog.repository.js";

/** Client status label for a schedule ("Active" | "Inactive"). */
export const scheduleLabel = (status) => (status === "ACTIVE" ? "Active" : "Inactive");

const labelled = (s) => ({ ...s, status: scheduleLabel(s.status) });

/** Optional status on create/update: "Active"/"ACTIVE" or "Inactive"/"INACTIVE"; "" keeps the default. */
function storedStatus(value, v) {
  if (!value) return null;
  const s = value.toUpperCase();
  if (s !== "ACTIVE" && s !== "INACTIVE") v.add("status", "Status must be Active or Inactive.");
  return s;
}

/**
 * Validates a decoded POST /schedules body (see decodeSchedule) with Go's messages and returns the
 * fields to store (times normalised to "HH:MM", default working days Mon-Fri).
 */
export function validateSchedule(input) {
  const v = new ValidationError();
  // An empty optional end date from a form means "no end date".
  if (input.effectiveEndDate === "") input = { ...input, effectiveEndDate: null };
  if (input.serviceId === "") input = { ...input, serviceId: null };
  if (!input.departmentId) v.add("departmentId", "Department is required.");
  const workingDays = input.workingDays && input.workingDays.length > 0 ? input.workingDays : WEEKDAYS.slice(0, 5);
  for (const d of workingDays) {
    if (!WEEKDAYS.includes(d)) v.add("workingDays", `Unknown day ${JSON.stringify(d)} (use Mon..Sun).`);
  }
  const open = parseClock(input.openingTime);
  const closing = parseClock(input.closingTime);
  if (open === null || closing === null || !(closing > open)) {
    v.add("closingTime", "Opening/closing must be HH:MM and closing must be after opening.");
  }
  if (input.dailyCapacity <= 0) v.add("dailyCapacity", "Daily capacity must be positive.");
  if (!parseDate(input.effectiveStartDate)) v.add("effectiveStartDate", "Start date must be YYYY-MM-DD.");
  if (input.effectiveEndDate !== null && input.effectiveEndDate < input.effectiveStartDate) {
    v.add("effectiveEndDate", "End date cannot precede start date.");
  } else if (input.effectiveEndDate !== null && !parseDate(input.effectiveEndDate)) {
    // Go passed this to Postgres unchecked (::date cast failed -> 500); a 422 is clearer.
    v.add("effectiveEndDate", "End date must be YYYY-MM-DD.");
  }
  const status = storedStatus(input.status, v);
  v.throwIfAny();
  return {
    ...(status ? { status } : {}),
    departmentId: input.departmentId,
    serviceId: input.serviceId,
    workingDays,
    openingTime: hhmm(open),
    closingTime: hhmm(closing),
    dailyCapacity: input.dailyCapacity,
    effectiveStartDate: input.effectiveStartDate,
    effectiveEndDate: input.effectiveEndDate,
  };
}

export function createScheduleService({ events }) {
  /** Department and service must exist (Postgres foreign keys; a violation was a 500 in Go). */
  async function checkReferences(fields) {
    const v = new ValidationError();
    if (!(await catalog.departmentExists(fields.departmentId))) {
      v.add("departmentId", "Department does not exist.");
    }
    if (fields.serviceId !== null && !(await catalog.serviceExists(fields.serviceId))) {
      v.add("serviceId", "Service does not exist.");
    }
    v.throwIfAny();
  }

  async function get(id) {
    const s = await schedules.findById(id);
    if (!s) throw new NotFoundError();
    return labelled(s);
  }

  return {
    /** All schedules, ordered by department name, then newest effective start first. */
    async list() {
      return (await schedules.findAll()).map(labelled);
    },

    /** Public: ACTIVE schedules not yet ended, for the citizen booking page. */
    async listBookable() {
      return (await schedules.findBookable(today())).map(labelled);
    },

    async create(input) {
      const fields = validateSchedule(decodeSchedule(input));
      await checkReferences(fields);
      const id = newId("SCH");
      await schedules.create({ _id: id, status: "ACTIVE", ...fields });
      const created = await get(id);
      events.publish("catalog.schedule.created", id, created);
      return created;
    },

    async update(id, input) {
      const fields = validateSchedule(decodeSchedule(input));
      await checkReferences(fields);
      if (!(await schedules.update(id, fields))) throw new NotFoundError();
      const updated = await get(id);
      events.publish("catalog.schedule.updated", id, updated);
      return updated;
    },

    async toggle(id) {
      const status = await schedules.toggleStatus(id);
      if (status === null) throw new NotFoundError();
      events.publish("catalog.schedule.status_changed", id, { status: scheduleLabel(status) });
      return { id, status: scheduleLabel(status) };
    },

    async remove(id) {
      if (!(await schedules.remove(id))) throw new NotFoundError();
      events.publish("catalog.schedule.deleted", id, null);
    },
  };
}
