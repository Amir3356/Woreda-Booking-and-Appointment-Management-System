// The booking grid of a schedule: 30-minute appointment times from its opening time until its
// closing time (the last one ends at or before closing), minus the times that overlap its lunch
// break; booking reopens with the first time after the break. Also the checks of a booking against
// a schedule (working days, working hours, lunch break, capacities). No I/O.
import { DAY_NAMES, minutes, pad, parseClock, parseDate, weekdayOf } from "./date.js";

const SLOT_MINUTES = 30;
export const DEFAULT_MAX_PARALLEL_SLOTS = 3;

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
export function isLunch(schedule, m) {
  if (!schedule?.lunchStart || !schedule?.lunchEnd) return false;
  return m < minutes(schedule.lunchEnd) && m + SLOT_MINUTES > minutes(schedule.lunchStart);
}

/** "12:30–13:30" for the messages. */
const lunchLabel = (schedule) => `${schedule.lunchStart}–${schedule.lunchEnd}`;

/** Start minute of every appointment time in the working hours: opening, +30, ... while it ends by closing. */
export function slotStarts(schedule) {
  if (!schedule) return [];
  const open = minutes(schedule.openingTime);
  const closing = minutes(schedule.closingTime);
  const out = [];
  for (let m = open; m + SLOT_MINUTES <= closing; m += SLOT_MINUTES) out.push(m);
  return out;
}

/** How many bookable times a schedule's working hours hold (lunch break excluded). */
function openTimesCount(schedule) {
  return slotStarts(schedule).filter((m) => !isLunch(schedule, m)).length;
}

/**
 * Places per booking time: the woreda-wide maxParallelSlots, raised when the schedule's daily
 * capacity needs more (capacity 20 over 5 times -> 4 each), so the whole daily capacity can be booked.
 */
export function perTimeCapacity(schedule, maxParallelSlots) {
  const times = openTimesCount(schedule);
  if (!schedule?.dailyCapacity || times === 0) return maxParallelSlots;
  return Math.max(maxParallelSlots, Math.ceil(schedule.dailyCapacity / times));
}

/**
 * Why the schedule does not allow this booking, or null when it does: { field, issue } for the 422.
 */
export function scheduleIssue(schedule, date, timeSlot) {
  if (!schedule) return { field: "date", issue: "This service is not open for booking on that date." };
  if (!(schedule.workingDays ?? []).includes(weekdayOf(date))) {
    return { field: "date", issue: `This service is closed on ${DAY_NAMES[weekdayOf(date)]}s.` };
  }
  const start = slotMinutes(timeSlot);
  const open = parseClock(schedule.openingTime) ?? 0;
  const close = parseClock(schedule.closingTime) ?? 0;
  if (start === null || start < open || start + SLOT_MINUTES > close) {
    return { field: "timeSlot", issue: `That time is outside the working hours (${schedule.openingTime}–${schedule.closingTime}).` };
  }
  if ((start - open) % SLOT_MINUTES !== 0) {
    return { field: "timeSlot", issue: "Appointments start every 30 minutes from the opening time; choose one of the offered times." };
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
export function buildSlots(schedule, day, counts, max) {
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
