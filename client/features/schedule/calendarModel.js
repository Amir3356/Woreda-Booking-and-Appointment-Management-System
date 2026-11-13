// Schedule exception types and date range helpers used by Schedule Management and ConfirmDialog.

export const EXCEPTION_TYPES = {
  PUBLIC_HOLIDAY: { label: "Public holiday", short: "Holiday", tone: "is-holiday", hint: "Closed for a national or religious holiday." },
  NON_WORKING_DAY: { label: "Non-working day", short: "Non-working", tone: "is-holiday", hint: "Government or department day off." },
  BLOCKED: { label: "Blocked dates", short: "Blocked", tone: "is-holiday", hint: "No bookings at all, even on working days." },
  WORKING_DAY: { label: "Exceptional working day", short: "Working day", tone: "is-exceptional", hint: "Open on a normally closed day, with its own hours." },
};

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
