// Calendar and clock helpers on "YYYY-MM-DD" / "HH:MM" strings, in the server's time zone (TZ).
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_NAMES = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

export const pad = (n) => String(n).padStart(2, "0");

/** Today's date as "YYYY-MM-DD". */
export function today(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** The current time as "HH:MM:SS" (24h). */
export function clockTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}

/** The current time of day in minutes since midnight. */
export function nowMinutes(date = new Date()) {
  const [h, m] = clockTime(date).split(":").map(Number);
  return (h % 24) * 60 + m;
}

/** Strict YYYY-MM-DD with a real calendar day. Returns a UTC Date or null. */
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

export const validDate = (s) => parseDate(s) !== null;

/** "Mon".."Sun" of a "YYYY-MM-DD" string or a parsed UTC Date. */
export function weekdayOf(date) {
  const d = typeof date === "string" ? parseDate(date) : date;
  return WEEKDAYS[(d.getUTCDay() + 6) % 7];
}

/** "HH:MM" (hour 0-23, minute 00-59) -> minutes since midnight, or null. */
export function parseClock(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(typeof s === "string" ? s : "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "HH:MM" -> minutes since midnight, 0 when unparsable. */
export const minutes = (s) => parseClock(s) ?? 0;

/** Minutes since midnight -> "HH:MM". */
export const hhmm = (m) => `${pad(Math.trunc(m / 60))}:${pad(m % 60)}`;

/** "HH:MM:SS" -> "HH12:MI AM"; "" for null. */
export function clock12(t) {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  return `${pad(h % 12 || 12)}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}

// Client slot format, e.g. "09:00 AM", "13:30 PM" (24h hour + AM/PM suffix as in the UI).
export const isTimeSlot = (s) => /^\d{2}:\d{2} (AM|PM)$/.test(s);

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** [from, to) appointment dates for TODAY | THIS_WEEK (Monday start) | THIS_MONTH (default). */
export function summaryRange(period, todayStr) {
  switch (String(period).toUpperCase()) {
    case "TODAY":
      return { from: todayStr, to: addDays(todayStr, 1) };
    case "THIS_WEEK": {
      const weekday = new Date(`${todayStr}T00:00:00Z`).getUTCDay();
      const from = addDays(todayStr, -((weekday + 6) % 7));
      return { from, to: addDays(from, 7) };
    }
    default: {
      const [y, m] = todayStr.split("-").map(Number);
      const from = `${todayStr.slice(0, 7)}-01`;
      const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      return { from, to };
    }
  }
}
