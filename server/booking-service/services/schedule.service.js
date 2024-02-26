// Operating schedule rules (Go service/schedule_service.go): validation, referenced department and
// service must exist, and the client's status labels.
import { NotFoundError, ValidationError } from "../utils/errors.js";
import { newId } from "../utils/id.js";
import { WEEKDAYS, hhmm, parseClock, parseDate } from "../utils/time.js";
import { decodeSchedule } from "../utils/decode.js";
import * as schedules from "../repositories/schedule.repository.js";
import * as catalog from "../repositories/catalog.repository.js";

/** Client status label for a schedule ("Active" | "Inactive"). */
export const scheduleLabel = (status) => (status === "ACTIVE" ? "Active" : "Inactive");

const labelled = (s) => ({ ...s, status: scheduleLabel(s.status) });

/**
 * Validates a decoded POST /schedules body (see decodeSchedule) with Go's messages and returns the
 * fields to store (times normalised to "HH:MM", default working days Mon-Fri).
 */
export function validateSchedule(input) {
  const v = new ValidationError();
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
  v.throwIfAny();
  return {
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

export function createScheduleService() {
  return {
    /** All schedules, ordered by department name, then newest effective start first. */
    async list() {
      return (await schedules.findAll()).map(labelled);
    },

    async create(input) {
      const fields = validateSchedule(decodeSchedule(input));
      // Postgres foreign keys (a violation was a 500 in Go): report them as field errors instead.
      const v = new ValidationError();
      if (!(await catalog.departmentExists(fields.departmentId))) {
        v.add("departmentId", "Department does not exist.");
      }
      if (fields.serviceId !== null && !(await catalog.serviceExists(fields.serviceId))) {
        v.add("serviceId", "Service does not exist.");
      }
      v.throwIfAny();
      const id = newId("SCH");
      await schedules.create({ _id: id, ...fields, status: "ACTIVE" });
      const created = await schedules.findById(id);
      if (!created) throw new NotFoundError();
      return labelled(created);
    },
  };
}
