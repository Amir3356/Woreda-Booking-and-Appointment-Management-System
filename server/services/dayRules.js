// Loads what decides one booking day (operating hours, calendar exceptions, booking closure and
// the department's daily capacity) and resolves it with utils/calendar.js. Booking and slot
// availability both go through here, so the backend enforces exactly what the pages show.
import { DAY_NAMES, weekdayOf } from "../utils/date.js";
import { exceptionsOn, resolveDay } from "../utils/calendar.js";
import * as schedules from "../repositories/schedule.repository.js";
import * as calendar from "../repositories/calendar.repository.js";

/** { serviceId, departmentId (may be null), date }, optional transaction client -> resolveDay result. */
export async function effectiveDay({ serviceId, departmentId, date }, client) {
  const [baseSchedule, exceptions, closure, departmentCapacity] = await Promise.all([
    schedules.findActive(serviceId, departmentId, date, client),
    calendar.findExceptions({ from: date, to: date, departmentId }, client),
    departmentId ? calendar.findClosure(departmentId, date, client) : null,
    departmentId ? calendar.findCapacity(departmentId, client) : null,
  ]);
  return resolveDay({
    date,
    baseSchedule,
    exceptions: exceptionsOn(exceptions, departmentId, date),
    closure,
    departmentCapacity,
  });
}

/** Citizen-facing reason a closed day cannot be booked (the 422 issue text). */
export function closedIssue(day, date) {
  const title = day.exception?.title;
  switch (day.reason) {
    case "BOOKING_DISABLED":
      return "Online booking is closed on that date. Choose another date.";
    case "BLOCKED":
      return `That date is blocked for appointments${title ? ` (${title})` : ""}. Choose another date.`;
    case "PUBLIC_HOLIDAY":
      return `That date is a public holiday${title ? ` (${title})` : ""}. Choose another date.`;
    case "NON_WORKING_DAY":
      return `That date is a non-working day${title ? ` (${title})` : ""}. Choose another date.`;
    case "NOT_WORKING_DAY":
      return `This service is closed on ${DAY_NAMES[weekdayOf(date)]}s.`;
    default:
      return "This service is not open for booking on that date.";
  }
}
