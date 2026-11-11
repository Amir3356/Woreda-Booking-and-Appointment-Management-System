// Date ranges for the month / week calendars and how a day's status is labelled and coloured.
// The statuses themselves come from the server (GET /schedules/calendar), which applies the same
// rules as booking: disabled booking > blocked > exceptional working day > holiday / non-working
// day > weekly operating hours.
import { addDays, localIsoDate, weekdayOfIso } from "@/utils";

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const REASON_LABELS = {
  BOOKING_DISABLED: "Booking disabled",
  BLOCKED: "Blocked",
  PUBLIC_HOLIDAY: "Public holiday",
  NON_WORKING_DAY: "Non-working day",
  NOT_WORKING_DAY: "Closed (weekly hours)",
  NO_SCHEDULE: "No operating hours",
};

export const EXCEPTION_TYPES = {
  PUBLIC_HOLIDAY: { label: "Public holiday", short: "Holiday", tone: "is-holiday", hint: "Closed for a national or religious holiday." },
  NON_WORKING_DAY: { label: "Non-working day", short: "Non-working", tone: "is-holiday", hint: "Government or department day off." },
  BLOCKED: { label: "Blocked dates", short: "Blocked", tone: "is-holiday", hint: "No bookings at all, even on working days." },
  WORKING_DAY: { label: "Exceptional working day", short: "Working day", tone: "is-exceptional", hint: "Open on a normally closed day, with its own hours." },
};

/** Exception types that close days (so booked appointments may be affected). */
export const CLOSING_TYPES = ["PUBLIC_HOLIDAY", "NON_WORKING_DAY", "BLOCKED"];

/** Tone class of one department's day. */
export function entryTone(entry) {
  if (!entry) return "is-unavailable";
  switch (entry.status) {
    case "AVAILABLE":
      return "is-available";
    case "EXCEPTIONAL":
      return "is-exceptional";
    case "FULL":
      return "is-full";
    default:
      return ["NOT_WORKING_DAY", "NO_SCHEDULE"].includes(entry.reason) ? "is-unavailable" : "is-holiday";
  }
}

/** Short label of one department's day. */
export function entryLabel(entry) {
  if (!entry) return "";
  if (entry.status === "AVAILABLE") return "Available";
  if (entry.status === "EXCEPTIONAL") return "Exceptional working day";
  if (entry.status === "FULL") return "Fully booked";
  return REASON_LABELS[entry.reason] || "Unavailable";
}

export const isOpen = (entry) => entry && (entry.status === "AVAILABLE" || entry.status === "EXCEPTIONAL" || entry.status === "FULL");

/**
 * One day across several departments: tone (mixed when they differ), open count, bookings and
 * capacity summed over the departments that have a limit.
 */
export function summarizeDay(entries) {
  const tones = new Set(entries.map(entryTone));
  const open = entries.filter(isOpen).length;
  const booked = entries.reduce((s, e) => s + e.booked, 0);
  const limited = entries.filter((e) => e.capacity);
  const capacity = limited.length ? limited.reduce((s, e) => s + e.capacity, 0) : null;
  const notes = [...new Set(entries.map((e) => e.note).filter(Boolean))];
  return {
    tone: tones.size === 1 ? [...tones][0] : "is-mixed",
    open,
    total: entries.length,
    booked,
    capacity,
    bookingDisabled: entries.some((e) => e.bookingDisabled),
    notes,
  };
}

/** Monday-start grid covering the month of anchor: { from, to, month: "YYYY-MM" }. */
export function monthRange(anchor) {
  const first = `${anchor.slice(0, 7)}-01`;
  const [y, m] = first.split("-").map(Number);
  const last = localIsoDate(new Date(y, m, 0));
  const from = addDays(first, -WEEKDAYS.indexOf(weekdayOfIso(first)));
  const to = addDays(last, 6 - WEEKDAYS.indexOf(weekdayOfIso(last)));
  return { from, to, month: anchor.slice(0, 7) };
}

/** Monday..Sunday of the week containing anchor. */
export function weekRange(anchor) {
  const from = addDays(anchor, -WEEKDAYS.indexOf(weekdayOfIso(anchor)));
  return { from, to: addDays(from, 6), month: anchor.slice(0, 7) };
}

/** Moves the anchor by one month or one week. */
export function shiftAnchor(anchor, view, step) {
  if (view === "week") return addDays(anchor, 7 * step);
  const [y, m] = anchor.split("-").map(Number);
  return localIsoDate(new Date(y, m - 1 + step, 1));
}

const toDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function periodLabel(anchor, view) {
  if (view === "week") {
    const { from, to } = weekRange(anchor);
    const opts = { month: "short", day: "numeric" };
    return `${toDate(from).toLocaleDateString("en-US", opts)} – ${toDate(to).toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
  }
  return toDate(anchor).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** "2026-12-07" -> "Mon, Dec 7". */
export function shortDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** "Dec 7 – Dec 9, 2026" or a single date. */
export function rangeLabel(from, to) {
  if (!from) return "";
  if (!to || to === from) return shortDate(from);
  return `${shortDate(from)} – ${shortDate(to)}`;
}

/** Inclusive number of days between two ISO dates. */
export function daysBetween(from, to) {
  const [a, b] = [from, to].map((s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86400000) + 1;
}

/** Orders two dates into { start, end }. */
export const orderedRange = (a, b) => (a <= b ? { start: a, end: b } : { start: b, end: a });

export const inRange = (date, sel) => Boolean(sel && date >= sel.start && date <= sel.end);
