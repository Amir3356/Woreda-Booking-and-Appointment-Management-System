// Reusable Zod building blocks for request validation. Messages are the ones the web app shows.
import { z } from "zod";
import { WEEKDAYS, hhmm, parseClock, today, validDate } from "../utils/date.js";

const ETHIOPIAN_PHONE = /^\+2519\d{8}$/;
const PHONE_MESSAGE = "Phone number must match valid Ethiopian format (+2519XXXXXXXX).";
const TIME_SLOT_MESSAGE = 'Time slot must look like "09:00 AM".';
export { WEEKDAYS };

/** Required, trimmed text of at least min characters; one message for missing or too short. */
export const requiredText = (message, min = 1) => z.string({ error: message }).trim().min(min, { error: message });

/** Optional text: missing or null becomes "". */
export const optionalText = z.string().trim().nullish().transform((v) => v ?? "");

/** Optional text: missing, null or blank becomes null. */
export const nullableText = z.string().trim().nullish().transform((v) => (v ? v : null));

/** Optional boolean: missing or null becomes false. */
export const optionalBoolean = z.boolean().nullish().transform((v) => v ?? false);

/** Optional whole number: missing or null becomes fallback. */
export const optionalInt = (fallback = 0) => z.number().int().nullish().transform((v) => v ?? fallback);

/** Positive whole number; missing, null or "" becomes fallback; numeric strings are accepted. */
export const positiveInt = (fallback, message) =>
  z.preprocess((v) => (v == null || v === "" ? fallback : v), z.coerce.number({ error: message }).int({ error: message }).positive({ error: message }));

/** "0911 234 567", "251911234567" or "+251 911 234 567" -> "+251911234567". */
export function normalizePhone(value) {
  const digits = String(value).replace(/[^\d+]/g, "");
  if (digits.startsWith("+251")) return digits;
  if (digits.startsWith("251")) return `+${digits}`;
  if (digits.startsWith("09")) return `+251${digits.slice(1)}`;
  if (digits.startsWith("9")) return `+251${digits}`;
  return digits;
}

/** Ethiopian mobile number in any common spelling, normalized to +2519XXXXXXXX. */
export const phone = z
  .string({ error: PHONE_MESSAGE })
  .transform(normalizePhone)
  .pipe(z.string().regex(ETHIOPIAN_PHONE, { error: PHONE_MESSAGE }));

/** "YYYY-MM-DD" with a real calendar day. */
export const dateString = (message = "Date must be YYYY-MM-DD.") =>
  z.string({ error: message }).refine(validDate, { error: message, abort: true });

/** A booking date: valid and not in the past. */
export const bookingDate = (message = "Date must be YYYY-MM-DD.") =>
  dateString(message).refine((d) => d >= today(), { error: "Date cannot be in the past." });

/** Client slot label, e.g. "09:00 AM". */
export const timeSlot = z.string({ error: TIME_SLOT_MESSAGE }).regex(/^\d{2}:\d{2} (AM|PM)$/, { error: TIME_SLOT_MESSAGE });

/** "H:MM"/"HH:MM" clock time, normalized to "HH:MM". */
export const clockTime = (message) =>
  z.string({ error: message }).refine((s) => parseClock(s) !== null, { error: message, abort: true }).transform((s) => hhmm(parseClock(s)));

// ---- query strings (values arrive as strings; a repeated key gives an array: take the first) ----

const first = (v) => (Array.isArray(v) ? v[0] : v);

/** Query text, "" when absent. */
export const queryText = z.preprocess(first, z.string().optional()).transform((v) => (v ?? "").trim());

/** Query text in upper case, "" when absent. */
export const queryUpper = queryText.transform((v) => v.toUpperCase());

/** Whole number in [min, max]; anything else (absent, not a number, out of range) becomes fallback. */
export const queryInt = (fallback, min, max) =>
  z.preprocess(first, z.coerce.number().int().min(min).max(max).catch(fallback));

/** true/1/t or false/0/f; anything else is undefined (no filter). */
export const queryBoolean = queryText.transform((v) => {
  const s = v.toLowerCase();
  if (["true", "1", "t"].includes(s)) return true;
  if (["false", "0", "f"].includes(s)) return false;
  return undefined;
});

/** Required query value. */
export const queryRequired = (message) => z.preprocess(first, z.string({ error: message }).trim().min(1, { error: message }));

/** Registry page/limit: page >= 1 (default 1), limit 1..200 (default 20). */
export const pageQuery = {
  page: queryInt(1, 1, Number.MAX_SAFE_INTEGER),
  limit: queryInt(20, 1, 200),
};
