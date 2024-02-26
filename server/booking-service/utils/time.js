// Pure date/time helpers: Go-compatible parsing of "HH:MM" and "YYYY-MM-DD", the clock formats the
// API returns, and today's date / the current time in the service's time zone.

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const pad = (n) => String(n).padStart(2, "0");

/** Today's date as "YYYY-MM-DD" in the service's time zone (TZ, Africa/Addis_Ababa in compose). */
export function today(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** The current time as "HH:MM:SS" (24h) in the service's time zone. */
export function clockTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}

/** Go time.Parse("15:04", s): hour 1-2 digits (0-23), minute exactly 2 digits (0-59). Returns minutes or null. */
export function parseClock(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(typeof s === "string" ? s : "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "HH:MM" -> minutes since midnight, 0 when unparsable (Go's minutes helper). */
export const minutes = (hhmm) => parseClock(hhmm) ?? 0;

/** Minutes since midnight -> "HH:MM" (Postgres to_char(time, 'HH24:MI')). */
export const hhmm = (m) => `${pad(Math.trunc(m / 60))}:${pad(m % 60)}`;

/** Go time.Parse(time.DateOnly, s): strict YYYY-MM-DD with a real calendar day. Returns a UTC Date or null. */
export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof s === "string" ? s : "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCMonth() !== mo - 1) return null; // day out of range (e.g. 2026-02-30)
  date.setUTCFullYear(y); // years 0000-0099
  return date;
}

/** "Mon".."Sun" for a parsed date (Go: weekdays[(Weekday()+6)%7]). */
export const weekdayOf = (date) => WEEKDAYS[(date.getUTCDay() + 6) % 7];

/** "HH:MM:SS" -> "HH12:MI AM" (Postgres to_char(time, 'HH12:MI AM')); "" for null. */
export function clock12(t) {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  return `${pad(h % 12 || 12)}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}
