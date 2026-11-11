// The municipal booking grid: 30-minute slots from 08:30 to 16:30, lunch break at 12:30, and the
// checks of a booking against a schedule (working days, opening hours, capacities). No I/O.
import { DAY_NAMES, minutes, pad, parseClock, parseDate, weekdayOf } from "./date.js";

export const SLOT_MINUTES = 30;
export const FIRST_SLOT_MIN = 8 * 60 + 30;
export const LAST_SLOT_MIN = 16 * 60 + 30;
export const LUNCH_SLOT_MIN = 12 * 60 + 30;
export const DEFAULT_MAX_PARALLEL_SLOTS = 3;

/** Minutes since midnight in the client format ("09:00 AM", "13:30 PM"). */
export function slotLabel(m) {
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

/** How many booking times a schedule's opening hours hold (lunch break excluded). */
export function openTimesCount(schedule) {
  if (!schedule) return 0;
  const open = minutes(schedule.openingTime);
  const closing = minutes(schedule.closingTime);
  let n = 0;
  for (let m = FIRST_SLOT_MIN; m <= LAST_SLOT_MIN; m += SLOT_MINUTES) {
    if (m >= open && m + SLOT_MINUTES <= closing && m !== LUNCH_SLOT_MIN) n++;
  }
  return n;
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
  const onGrid = start !== null && start >= FIRST_SLOT_MIN && start <= LAST_SLOT_MIN && (start - FIRST_SLOT_MIN) % SLOT_MINUTES === 0;
  if (start === LUNCH_SLOT_MIN) return { field: "timeSlot", issue: "12:30 PM is the lunch break; choose another time." };
  if (!onGrid || start < open || start + SLOT_MINUTES > close) {
    return { field: "timeSlot", issue: `That time is outside the service's opening hours (${schedule.openingTime}–${schedule.closingTime}).` };
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
export const labelMinutes = (label) => {
  const [h, m] = String(label).slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

/** Today only: a time that has already started becomes Unavailable. */
export function markPast(slots, nowMin) {
  return slots.map((s) =>
    s.status !== "Unavailable" && labelMinutes(s.timeSlot) <= nowMin ? { ...s, status: "Unavailable", remainingCapacity: 0 } : s,
  );
}

/** Once the day's bookings reach the schedule's daily capacity, every open slot is Full. */
export function applyDailyCapacity(slots, reason) {
  if (reason !== "DAILY_CAPACITY_REACHED") return slots;
  return slots.map((s) => (s.status === "Available" ? { ...s, status: "Full", remainingCapacity: 0 } : s));
}

/** Per-slot availability. day: "YYYY-MM-DD" or parsed date, counts: {"09:00 AM": n}, max: places per time. */
export function buildSlots(schedule, day, counts, max) {
  const d = typeof day === "string" ? parseDate(day) : day;
  let open = 0;
  let closing = 0;
  if (schedule && (schedule.workingDays ?? []).includes(weekdayOf(d))) {
    open = minutes(schedule.openingTime);
    closing = minutes(schedule.closingTime);
  }
  const slots = [];
  for (let m = FIRST_SLOT_MIN; m <= LAST_SLOT_MIN; m += SLOT_MINUTES) {
    const timeSlot = slotLabel(m);
    const slot = { timeSlot, bookedCount: counts[timeSlot] ?? 0, remainingCapacity: 0, status: "" };
    if (m < open || m + SLOT_MINUTES > closing || m === LUNCH_SLOT_MIN) {
      slot.status = "Unavailable";
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
