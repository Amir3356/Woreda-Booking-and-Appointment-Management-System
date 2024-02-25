import { randomBytes } from "node:crypto";

/** "srv" -> "srv-7c2b063b8a1c" (12 hex characters), the same shape as the Go services' IDs. */
export function newId(prefix) {
  const hex = randomBytes(6).toString("hex");
  const p = String(prefix || "").trim().replace(/-$/, "");
  return p ? `${p}-${hex}` : hex;
}

/** Today's date as "YYYY-MM-DD" in the service's time zone (TZ, Africa/Addis_Ababa in compose). */
export function today(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** The current time as "HH:MM:SS" (24h) in the service's time zone. */
export function clockTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}
