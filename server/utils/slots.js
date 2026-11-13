// The booking grid of a schedule: 30-minute appointment times from its opening time until its
// closing time (the last one ends at or before closing), minus the times that overlap its lunch
// break; booking reopens with the first time after the break. Also the checks of a booking against
// a schedule (working days, working hours, lunch break, capacities). No I/O.
import { DAY_NAMES, minutes, pad, parseClock, parseDate, weekdayOf } from "./date.js";

const SLOT_MINUTES = 30;
export const DEFAULT_SLOT_MINUTES = 30;
export const DEFAULT_MAX_PARALLEL_SLOTS = 1;

/** Slot duration in minutes configured on the schedule (defaults to 30). */
export function slotDuration(schedule) {
  const n = schedule?.slotIntervalMinutes ?? schedule?.slot_interval_minutes;
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_SLOT_MINUTES;
}

/** Minutes since midnight in the client format ("09:00 AM", "13:30 PM"). */
function slotLabel(m) {
  const suffix = m >= 12 * 60 ? "PM" : "AM";
  return `${pad(Math.trunc(m / 60))}:${pad(m % 60)} ${suffix}`;
}

/** Slot label ("09:00 AM", "13:30 PM" or "01:30 PM") -> minutes since midnight, or null. */
export function slotMinutes(label) {
  const m = /^(\d{2}):(\d{2}) (AM|PM)$/.exec(String(label ?? ""));
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3] === "PM" && h < 12) h += 12;
  if (m[3] === "AM" && h === 12) h = 0;
  return h * 60 + Number(m[2]);
}

/**
 * Whether an appointment starting at m (minutes) overlaps the schedule's lunch break
 * [lunchStart, lunchEnd). A schedule without a configured break has none.
 */
function isLunch(schedule, m) {
  if (!schedule?.lunchStart || !schedule?.lunchEnd) return false;
  const duration = slotDuration(schedule);
  return m < minutes(schedule.lunchEnd) && m + duration > minutes(schedule.lunchStart);
}

/** "12:30–13:30" for the messages. */
const lunchLabel = (schedule) => `${schedule.lunchStart}–${schedule.lunchEnd}`;

/** Start minute of every appointment time in the working hours: opening, +duration, ... while it ends by closing. */
function slotStarts(schedule) {
  if (!schedule) return [];
  const open = minutes(schedule.openingTime);
  const closing = minutes(schedule.closingTime);
  const duration = slotDuration(schedule);
  const out = [];
  for (let m = open; m + duration <= closing; m += duration) out.push(m);
  return out;
}

/** How many bookable times a schedule's working hours hold (lunch break excluded). */
function openTimesCount(schedule) {
  return slotStarts(schedule).filter((m) => !isLunch(schedule, m)).length;
}

/**
 * Places per booking time: exactly 1 booking is allowed per service, date, and time slot
 * to strictly prevent duplicate bookings for the same service, date, and time.
 */
export function perTimeCapacity(schedule, maxParallelSlots = 1) {
  return 1;
}

/**
 * Why the schedule does not allow this booking, or null when it does: { field, issue } for the 422.
 */
export function scheduleIssue(schedule, date, timeSlot) {
  if (!schedule) return { field: "date", issue: "This service is not open for booking on that date." };
  if (!(schedule.workingDays ?? []).includes(weekdayOf(date))) {
    return { field: "date", issue: `This service is closed on ${DAY_NAMES[weekdayOf(date)]}s.` };
  }
  const duration = slotDuration(schedule);
  const start = slotMinutes(timeSlot);
  const open = parseClock(schedule.openingTime) ?? 0;
  const close = parseClock(schedule.closingTime) ?? 0;
  if (start === null || start < open || start + duration > close) {
    return { field: "timeSlot", issue: `That time is outside the working hours (${schedule.openingTime}–${schedule.closingTime}).` };
  }
  if ((start - open) % duration !== 0) {
    return { field: "timeSlot", issue: `Appointments start every ${duration} minutes from the opening time; choose one of the offered times.` };
  }
  if (isLunch(schedule, start)) {
    return { field: "timeSlot", issue: `That time is during the lunch break (${lunchLabel(schedule)}); choose another time.` };
  }
  return null;
}

/**
 * Why nothing can be booked on the day, or null when the day is open:
 * NO_SCHEDULE, NOT_WORKING_DAY, DAILY_CAPACITY_REACHED.
 */
export function closedReason(schedule, day, bookedForDay) {
  if (!schedule) return "NO_SCHEDULE";
  if (!(schedule.workingDays ?? []).includes(weekdayOf(day))) return "NOT_WORKING_DAY";
  if (schedule.dailyCapacity > 0 && bookedForDay >= schedule.dailyCapacity) return "DAILY_CAPACITY_REACHED";
  return null;
}

/** Start of a slot label in minutes since midnight ("13:30 PM" -> 810; labels use 24h hours). */
const labelMinutes = (label) => {
  const [h, m] = String(label).slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

/** Today only: a time that has already started becomes Unavailable. */
export function markPast(slots, nowMin) {
  return slots.map((s) =>
    s.status !== "Unavailable" && labelMinutes(s.timeSlot) <= nowMin ? { ...s, status: "Unavailable", remainingCapacity: 0 } : s,
  );
}

/** Once the day's bookings reach the service's or the department's daily capacity, every open slot is Full. */
export function applyDailyCapacity(slots, reason) {
  if (reason !== "DAILY_CAPACITY_REACHED" && reason !== "DEPARTMENT_CAPACITY_REACHED") return slots;
  return slots.map((s) => (s.status === "Available" ? { ...s, status: "Full", remainingCapacity: 0 } : s));
}

/**
 * Per-slot availability over the day's working hours (none on a closed day). Lunch-break times are
 * listed as Unavailable with lunchBreak: true. day: "YYYY-MM-DD" or parsed date,
 * counts: {"09:00 AM": n}, max: places per time.
 */
export function buildSlots(schedule, day, counts, max = 1) {
  const d = typeof day === "string" ? parseDate(day) : day;
  if (!schedule || !(schedule.workingDays ?? []).includes(weekdayOf(d))) return [];
  const slots = [];
  for (const m of slotStarts(schedule)) {
    const timeSlot = slotLabel(m);
    const slot = { timeSlot, bookedCount: counts[timeSlot] ?? 0, remainingCapacity: 0, status: "" };
    if (isLunch(schedule, m)) {
      slot.status = "Unavailable";
      slot.lunchBreak = true;
    } else if (slot.bookedCount >= max) {
      slot.status = "Full";
    } else {
      slot.status = "Available";
      slot.remainingCapacity = max - slot.bookedCount;
    }
    slots.push(slot);
  }
  return slots;
}
