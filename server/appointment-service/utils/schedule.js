// Pure checks of a booking against the service's schedule (working days, opening hours and the
// 30-minute booking grid with the 12:30 lunch break, as booking-service shows them).

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const SLOT_MINUTES = 30;
const FIRST_SLOT_MIN = 8 * 60 + 30;
const LAST_SLOT_MIN = 16 * 60 + 30;
const LUNCH_SLOT_MIN = 12 * 60 + 30;

/** "Mon".."Sun" of a "YYYY-MM-DD" date. */
export function weekdayOf(date) {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
}

/** "HH:MM" -> minutes since midnight, or null. */
export function clockMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
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
 * Why the schedule does not allow this booking, or null when it does:
 * { field, issue } for the 422 response.
 */
export function scheduleIssue(schedule, date, timeSlot) {
  if (!schedule) return { field: "date", issue: "This service is not open for booking on that date." };
  if (!(schedule.workingDays ?? []).includes(weekdayOf(date))) {
    return { field: "date", issue: `This service is closed on ${DAY_NAMES[weekdayOf(date)]}s.` };
  }
  const start = slotMinutes(timeSlot);
  const open = clockMinutes(schedule.openingTime) ?? 0;
  const close = clockMinutes(schedule.closingTime) ?? 0;
  const onGrid = start !== null && start >= FIRST_SLOT_MIN && start <= LAST_SLOT_MIN && (start - FIRST_SLOT_MIN) % SLOT_MINUTES === 0;
  if (start === LUNCH_SLOT_MIN) return { field: "timeSlot", issue: "12:30 PM is the lunch break; choose another time." };
  if (!onGrid || start < open || start + SLOT_MINUTES > close) {
    return { field: "timeSlot", issue: `That time is outside the service's opening hours (${schedule.openingTime}–${schedule.closingTime}).` };
  }
  return null;
}

/** How many booking times a schedule's opening hours hold (30-minute grid, lunch break excluded). */
export function openTimesCount(schedule) {
  const open = clockMinutes(schedule?.openingTime) ?? 0;
  const close = clockMinutes(schedule?.closingTime) ?? 0;
  let n = 0;
  for (let m = FIRST_SLOT_MIN; m <= LAST_SLOT_MIN; m += SLOT_MINUTES) {
    if (m >= open && m + SLOT_MINUTES <= close && m !== LUNCH_SLOT_MIN) n++;
  }
  return n;
}

/**
 * Places per booking time: at least the woreda-wide maxParallelSlots, more when the schedule's
 * daily capacity needs it (20 over 5 times -> 4), as booking-service availability shows it.
 */
export function perTimeCapacity(schedule, maxParallelSlots) {
  const times = openTimesCount(schedule);
  if (!schedule?.dailyCapacity || times === 0) return maxParallelSlots;
  return Math.max(maxParallelSlots, Math.ceil(schedule.dailyCapacity / times));
}

/** slot_reservations _id of a service's daily counter: "<serviceId>|<date>|DAY". */
export const dayKey = (serviceId, date) => `${serviceId}|${date}|DAY`;
