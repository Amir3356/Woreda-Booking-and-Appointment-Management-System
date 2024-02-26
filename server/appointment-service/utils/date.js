// Calendar-date helpers on "YYYY-MM-DD" strings (no I/O).

/** Today's date as "YYYY-MM-DD" in the service's time zone (TZ, Africa/Addis_Ababa in compose). */
export function today(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Strict YYYY-MM-DD with a real calendar day (Go time.Parse(time.DateOnly)). */
export function validDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

// Client slot format, e.g. "09:00 AM", "13:30 PM" (24h hour + AM/PM suffix as in the UI).
const timeSlotPattern = /^\d{2}:\d{2} (AM|PM)$/;

export const isTimeSlot = (s) => timeSlotPattern.test(s);

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
