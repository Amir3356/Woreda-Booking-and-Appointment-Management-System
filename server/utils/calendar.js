// The scheduling rules of one department (or service) on one date, without I/O. Everything that
// decides whether a date can be booked goes through resolveDay, so booking, slot availability,
// the admin calendar and the citizen's list of open dates always agree.
//
// Precedence, strongest first:
//   1. Booking disabled for the date (Appointment Availability)        -> closed  BOOKING_DISABLED
//   2. A BLOCKED calendar exception                                     -> closed  BLOCKED
//   3. An exceptional WORKING_DAY (its own hours and daily capacity)    -> open
//   4. A PUBLIC_HOLIDAY / NON_WORKING_DAY exception                     -> closed
//   5. The weekly operating hours (no schedule / not a working day)     -> closed or open
import { WEEKDAYS, minutes, weekdayOf } from "./date.js";
import { coversDepartment } from "../models/calendar.model.js";

export const CLOSED_REASONS = Object.freeze([
  "BOOKING_DISABLED", "BLOCKED", "PUBLIC_HOLIDAY", "NON_WORKING_DAY", "NO_SCHEDULE", "NOT_WORKING_DAY",
]);

/** Exceptions (API shape) in force on date for the department. */
export function exceptionsOn(exceptions, departmentId, date) {
  return exceptions.filter((e) => e.startDate <= date && e.endDate >= date && coversDepartment(e, departmentId));
}

/**
 * day: {
 *   date, baseSchedule (operating hours in force, or null), exceptions (already filtered to the
 *   department and date), closure ({ reason } or null), departmentCapacity (number or null)
 * }
 * -> { open, reason, schedule, departmentCapacity, exception, note }
 *   schedule: the operating hours that apply when open (an exceptional working day's own hours).
 *   departmentCapacity: the department-wide daily limit for the day, or null for none.
 */
export function resolveDay({ date, baseSchedule, exceptions = [], closure = null, departmentCapacity = null }) {
  const closed = (reason, exception = null, note = null) => ({
    open: false, reason, schedule: null, departmentCapacity: null, exception, note: note ?? exception?.title ?? null,
  });
  if (closure) return closed("BOOKING_DISABLED", null, closure.reason || "Online booking disabled for this date");
  const blocked = exceptions.find((e) => e.type === "BLOCKED");
  if (blocked) return closed("BLOCKED", blocked);
  const working = exceptions.find((e) => e.type === "WORKING_DAY");
  if (working) {
    return {
      open: true,
      reason: null,
      // The day is open whatever the weekly working days say, within the exception's hours.
      schedule: {
        ...(baseSchedule ?? {}),
        workingDays: [...WEEKDAYS],
        openingTime: working.openingTime,
        closingTime: working.closingTime,
        dailyCapacity: baseSchedule?.dailyCapacity ? Math.min(baseSchedule.dailyCapacity, working.dailyCapacity) : working.dailyCapacity,
      },
      departmentCapacity: working.dailyCapacity,
      exception: working,
      note: working.title,
    };
  }
  const holiday = exceptions.find((e) => e.type === "PUBLIC_HOLIDAY") ?? exceptions.find((e) => e.type === "NON_WORKING_DAY");
  if (holiday) return closed(holiday.type, holiday);
  if (!baseSchedule) return closed("NO_SCHEDULE");
  if (!(baseSchedule.workingDays ?? []).includes(weekdayOf(date))) return closed("NOT_WORKING_DAY");
  return { open: true, reason: null, schedule: baseSchedule, departmentCapacity, exception: null, note: null };
}

/** Schedules (API shape) in force on date: ACTIVE and inside their effective period. */
export const schedulesInForce = (schedules, date) =>
  schedules.filter((s) => s.status === "ACTIVE" && s.effectiveStartDate <= date && (!s.effectiveEndDate || s.effectiveEndDate >= date));

/**
 * Operating hours of a whole department on date: its department-wide schedule, or else the
 * combination of its service schedules (any working day, earliest opening, latest closing).
 * Null when nothing is in force.
 */
export function departmentHoursOn(schedules, departmentId, date) {
  const own = schedulesInForce(schedules.filter((s) => s.departmentId === departmentId), date);
  if (own.length === 0) return null;
  const wide = own.find((s) => !s.serviceId);
  if (wide) return wide;
  const byOpening = [...own].sort((a, b) => minutes(a.openingTime) - minutes(b.openingTime));
  const byClosing = [...own].sort((a, b) => minutes(b.closingTime) - minutes(a.closingTime));
  return {
    departmentId,
    serviceId: null,
    workingDays: WEEKDAYS.filter((d) => own.some((s) => s.workingDays.includes(d))),
    openingTime: byOpening[0].openingTime,
    closingTime: byClosing[0].closingTime,
    dailyCapacity: own.reduce((sum, s) => sum + s.dailyCapacity, 0),
    combined: true,
  };
}

/** The schedule for a service on date: its own first, else its department's department-wide one. */
export function serviceScheduleOn(schedules, serviceId, departmentId, date) {
  const inForce = schedulesInForce(schedules, date).sort((a, b) => (b.effectiveStartDate > a.effectiveStartDate ? 1 : -1));
  return inForce.find((s) => s.serviceId === serviceId)
    ?? (departmentId ? inForce.find((s) => !s.serviceId && s.departmentId === departmentId) : null)
    ?? null;
}

/** "YYYY-MM-DD" dates from..to inclusive. */
export function eachDate(from, to) {
  const out = [];
  const [y, m, d] = from.split("-").map(Number);
  for (let i = 0; ; i++) {
    const iso = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    if (iso > to) break;
    out.push(iso);
  }
  return out;
}

/** Number of days from..to inclusive. */
export const daySpan = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
