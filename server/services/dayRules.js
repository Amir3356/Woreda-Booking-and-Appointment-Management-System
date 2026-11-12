// Loads what decides one booking day (working hours and calendar exceptions) and resolves it
// with utils/calendar.js. Booking and slot
// availability both go through here, so the backend enforces exactly what the pages show.
import { DAY_NAMES, weekdayOf } from "../utils/date.js";
import { exceptionLabel, exceptionsOn, resolveDay } from "../utils/calendar.js";
import * as schedules from "../repositories/schedule.repository.js";
import * as calendar from "../repositories/calendar.repository.js";

/** { serviceId, departmentId (may be null), date }, optional transaction client -> resolveDay result. */
export async function effectiveDay({ serviceId, departmentId, date }, client) {
  const [baseSchedule, exceptions] = await Promise.all([
    schedules.findActive(serviceId, departmentId, date, client),
    calendar.findExceptions({ from: date, to: date, departmentId }, client),
  ]);
  return resolveDay({ date, baseSchedule, exceptions: exceptionsOn(exceptions, departmentId, date) });
}

/** Citizen-facing reason a closed day cannot be booked (the 422 issue text). */
export function closedIssue(day, date) {
  const label = exceptionLabel(day.exception);
  switch (day.reason) {
    case "BLOCKED":
    case "PUBLIC_HOLIDAY":
    case "NON_WORKING_DAY":
      return `No appointments can be booked on that date${label ? `: ${label}` : ""}. Choose another date.`;
    case "NOT_WORKING_DAY":
      return `This service is closed on ${DAY_NAMES[weekdayOf(date)]}s.`;
    default:
      return "This service is not open for booking on that date.";
  }
}
