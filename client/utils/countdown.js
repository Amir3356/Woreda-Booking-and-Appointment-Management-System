// Time left until an appointment, for the live countdowns in Citizen > My Queue.
// Appointment times are woreda (Addis Ababa) wall-clock times; Ethiopia is UTC+3 all year (no DST),
// so the start instant is fixed whatever time zone the citizen's device uses.

const WOREDA_UTC_OFFSET = "+03:00";

// Server clock minus device clock, learned from the timestamp on every API response (api/httpClient.js),
// so countdowns stay right on a device whose clock is wrong. The server time has whole seconds, so
// only a clearly wrong device clock (5 s or more) is corrected.
let serverOffsetMs = 0;
export function recordServerTime(isoTimestamp) {
  const serverNow = Date.parse(isoTimestamp ?? "");
  if (!Number.isFinite(serverNow)) return;
  const offset = serverNow - Date.now();
  serverOffsetMs = Math.abs(offset) >= 5000 ? offset : 0;
}
/** The current time on the server's clock (epoch ms). */
export const serverNow = () => Date.now() + serverOffsetMs;

/** "09:30 AM", "12:00 PM", "13:30 PM" (24-hour clock with a suffix) or "13:30" -> minutes since midnight, or null. */
export function slotToMinutes(slot) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?\s*$/i.exec(String(slot ?? ""));
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const suffix = (m[3] || "").toUpperCase();
  if (h <= 12) {
    if (suffix === "PM" && h < 12) h += 12;
    if (suffix === "AM" && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Start of the appointment as epoch milliseconds, or null. date: "YYYY-MM-DD". */
export function appointmentStartMs(date, slot) {
  const minutes = slotToMinutes(slot);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? "")) || minutes === null) return null;
  const hh = String(Math.trunc(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  const ms = Date.parse(`${date}T${hh}:${mm}:00${WOREDA_UTC_OFFSET}`);
  return Number.isNaN(ms) ? null : ms;
}

const pad = (n) => String(n).padStart(2, "0");

/**
 * Countdown state for remainingMs (start minus now).
 *   phase: "days" (24 h or more), "later" (> 30 min), "soon" (<= 30 min), "imminent" (<= 5 min),
 *          "now" (started up to 15 min ago), "late" (started more than 15 min ago)
 *   clock: "1d 04:12:09" / "04:12:09" / "00:04:59" while counting down; "+12 min" once started
 */
export function countdownState(remainingMs) {
  if (remainingMs > 0) {
    const total = Math.ceil(remainingMs / 1000);
    const days = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const hms = `${pad(h)}:${pad(m)}:${pad(s)}`;
    const phase = days > 0 ? "days" : total > 30 * 60 ? "later" : total > 5 * 60 ? "soon" : "imminent";
    return { phase, clock: days > 0 ? `${days}d ${hms}` : hms, days, hours: h, minutes: m, seconds: s };
  }
  const lateMin = Math.floor(-remainingMs / 60000);
  return { phase: lateMin <= 15 ? "now" : "late", clock: lateMin > 0 ? `+${lateMin} min` : "Now", lateMinutes: lateMin };
}
