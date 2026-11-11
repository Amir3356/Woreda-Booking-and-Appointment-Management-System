// Schedule helpers for booking: which Admin > Schedule Management schedules apply to a service,
// which dates can be booked, and how the server's slot labels are shown.
//
// A schedule applies to a service when it is for that service, or department-wide (no service)
// for the service's department. On a given date the service-specific one wins, as on the server
// (booking-service /schedules/availability decides the actual slots).

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
  Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

/** Today as "YYYY-MM-DD" in the browser's time zone. */
export function localIsoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "Mon".."Sun" of a "YYYY-MM-DD" date. */
export function weekdayOfIso(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[(new Date(y, m - 1, d).getDay() + 6) % 7];
}

export function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return localIsoDate(new Date(y, m - 1, d + n));
}

const isActive = (s) => !s.status || String(s.status).toUpperCase() === "ACTIVE";

/** Active schedules that apply to the service (service-specific first). */
export function schedulesForService(service, schedules) {
  if (!service) return [];
  const own = schedules.filter((s) => isActive(s) && s.serviceId === service.id);
  const deptWide = schedules.filter(
    (s) => isActive(s) && !s.serviceId && s.departmentId === service.departmentId
  );
  return [...own, ...deptWide];
}

/** The schedule in force on date (service-specific wins), or null. */
export function scheduleOn(service, schedules, date) {
  return (
    schedulesForService(service, schedules).find(
      (s) => s.effectiveStartDate <= date && (!s.effectiveEndDate || s.effectiveEndDate >= date)
    ) || null
  );
}

/**
 * Bookable date range for the service: { min, max } ("YYYY-MM-DD"; max null = open-ended),
 * or null when no schedule covers today or later.
 */
export function bookableRange(service, schedules, today = localIsoDate()) {
  const list = schedulesForService(service, schedules).filter(
    (s) => !s.effectiveEndDate || s.effectiveEndDate >= today
  );
  if (list.length === 0) return null;
  const starts = list.map((s) => (s.effectiveStartDate > today ? s.effectiveStartDate : today));
  const min = starts.sort()[0];
  const max = list.some((s) => !s.effectiveEndDate)
    ? null
    : list.map((s) => s.effectiveEndDate).sort().at(-1);
  return { min, max };
}

/** First date from `from` on which a schedule is in force and it is a working day (or null). */
export function nextWorkingDate(service, schedules, from = localIsoDate(), horizonDays = 366) {
  const range = bookableRange(service, schedules, from);
  if (!range) return null;
  let date = range.min;
  for (let i = 0; i < horizonDays; i += 1) {
    if (range.max && date > range.max) return null;
    const sch = scheduleOn(service, schedules, date);
    if (sch && (sch.workingDays || []).includes(weekdayOfIso(date))) return date;
    date = addDays(date, 1);
  }
  return null;
}

/** "Mon–Fri", "Daily (Mon–Sun)" or a list. */
export function formatWorkingDays(days) {
  const list = WEEKDAYS.filter((d) => (days || []).includes(d));
  if (list.length === 0) return "None";
  if (list.length === 7) return "Daily (Mon–Sun)";
  const first = WEEKDAYS.indexOf(list[0]);
  const consecutive = list.every((d, i) => WEEKDAYS.indexOf(d) === first + i);
  return consecutive && list.length > 2 ? `${list[0]}–${list.at(-1)}` : list.join(", ");
}

/** Server slot label ("09:00 AM", "13:30 PM") or "HH:MM" -> "9:00 AM" / "1:30 PM". */
export function displayTime(label) {
  const m = /^(\d{1,2}):(\d{2})/.exec(label || "");
  if (!m) return label || "";
  let h = Number(m[1]);
  if (/PM$/i.test(label) && h < 12) h += 12;
  if (/AM$/i.test(label) && h === 12) h = 0;
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
}

/** "YYYY-MM-DD" -> "Tue, Nov 10, 2026". */
export function displayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

/** A citizen-facing sentence for availability.closedReason (note: the holiday / exception name). */
export function closedMessage(reason, { date, schedule, note } = {}) {
  const named = note ? ` (${note})` : "";
  switch (reason) {
    case "BOOKING_DISABLED":
      return "Online booking is closed on that date. Choose another date.";
    case "BLOCKED":
      return `That date is not available for appointments${named}. Choose another date.`;
    case "PUBLIC_HOLIDAY":
      return `That date is a public holiday${named}. Choose another date.`;
    case "NON_WORKING_DAY":
      return `That date is a non-working day${named}. Choose another date.`;
    case "DEPARTMENT_CAPACITY_REACHED":
      return "The department is fully booked on that date. Choose another date.";
    case "NO_SCHEDULE":
      return "This service has no opening schedule on that date. Choose another date.";
    case "NOT_WORKING_DAY":
      return `This service is closed on ${date ? DAY_NAMES[weekdayOfIso(date)] + "s" : "that day"}${
        schedule ? `. Open ${formatWorkingDays(schedule.workingDays)}` : ""
      }. Choose another date.`;
    case "DAY_OVER":
      return "All of today's appointment times have already passed. Choose another date.";
    case "DAILY_CAPACITY_REACHED":
      return "All appointments for that day are taken. Choose another date.";
    default:
      return "";
  }
}
