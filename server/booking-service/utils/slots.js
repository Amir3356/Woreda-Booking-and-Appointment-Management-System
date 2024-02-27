// The municipal booking grid: 30-minute slots from 08:30 to 16:30, lunch break at 12:30.
import { minutes, pad, weekdayOf } from "./time.js";

export const SLOT_MINUTES = 30;
export const FIRST_SLOT_MIN = 8 * 60 + 30;
export const LAST_SLOT_MIN = 16 * 60 + 30;
export const LUNCH_SLOT_MIN = 12 * 60 + 30;

/** Minutes since midnight in the client format ("09:00 AM", "13:30 PM"), as Go's slotLabel. */
export function slotLabel(m) {
  const suffix = m >= 12 * 60 ? "PM" : "AM";
  return `${pad(Math.trunc(m / 60))}:${pad(m % 60)} ${suffix}`;
}

/**
 * Why nothing can be booked on the day, or null when the day is open:
 * NO_SCHEDULE (no active schedule covers the date), NOT_WORKING_DAY, DAILY_CAPACITY_REACHED.
 */
export function closedReason(schedule, day, bookedForDay) {
  if (!schedule) return "NO_SCHEDULE";
  if (!(schedule.workingDays ?? []).includes(weekdayOf(day))) return "NOT_WORKING_DAY";
  if (schedule.dailyCapacity > 0 && bookedForDay >= schedule.dailyCapacity) return "DAILY_CAPACITY_REACHED";
  return null;
}

/** Once the day's bookings reach the schedule's daily capacity, every open slot is Full. */
export function applyDailyCapacity(slots, reason) {
  if (reason !== "DAILY_CAPACITY_REACHED") return slots;
  return slots.map((s) => (s.status === "Available" ? { ...s, status: "Full", remainingCapacity: 0 } : s));
}

/**
 * Per-slot availability. schedule: the schedule in force (or null), day: parsed date,
 * counts: {"09:00 AM": n}, max: system_settings.maxParallelSlots.
 */
export function buildSlots(schedule, day, counts, max) {
  let open = 0;
  let closing = 0;
  if (schedule && (schedule.workingDays ?? []).includes(weekdayOf(day))) {
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
