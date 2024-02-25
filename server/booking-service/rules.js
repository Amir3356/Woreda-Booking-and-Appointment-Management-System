// Pure booking rules ported from the Go service: the slot grid, schedule validation and labels,
// queue token numbers, clock formats, and the Go JSON decoder's type checks.
import { BadRequestError, ValidationError } from "./lib/index.js";

// Municipal booking grid: 30-minute slots from 08:30 to 16:30, lunch break at 12:30.
export const SLOT_MINUTES = 30;
export const FIRST_SLOT_MIN = 8 * 60 + 30;
export const LAST_SLOT_MIN = 16 * 60 + 30;
export const LUNCH_SLOT_MIN = 12 * 60 + 30;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Rough per-citizen wait estimate (minutes). */
export const AVG_SERVICE_MINUTES = 15;

const pad = (n) => String(n).padStart(2, "0");

/** Minutes since midnight in the client format ("09:00 AM", "13:30 PM"), as Go's slotLabel. */
export function slotLabel(m) {
  const suffix = m >= 12 * 60 ? "PM" : "AM";
  return `${pad(Math.trunc(m / 60))}:${pad(m % 60)} ${suffix}`;
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

/**
 * Per-slot availability. schedule: the schedule in force (or null), day: parsed date,
 * counts: {"09:00 AM": n}, max: system_settings.maxParallelSlots.
 */
export function buildSlots(schedule, day, counts, max) {
  let open = 0;
  let closing = 0;
  if (schedule && (schedule.workingDays ?? []).includes(weekdayOf(day))) {
    open = minutes(schedule.openingTime);
    closing = minutes(schedule.closingTime);
  }
  const slots = [];
  for (let m = FIRST_SLOT_MIN; m <= LAST_SLOT_MIN; m += SLOT_MINUTES) {
    const timeSlot = slotLabel(m);
    const slot = { timeSlot, bookedCount: counts[timeSlot] ?? 0, remainingCapacity: 0, status: "" };
    if (m < open || m + SLOT_MINUTES > closing || m === LUNCH_SLOT_MIN) {
      slot.status = "Unavailable";
    } else if (slot.bookedCount >= max) {
      slot.status = "Full";
    } else {
      slot.status = "Available";
      slot.remainingCapacity = max - slot.bookedCount;
    }
    slots.push(slot);
  }
  return slots;
}

/** Validates availability query parameters (date first, as Go). Returns the parsed day. */
export function validateAvailability(serviceId, date) {
  const v = new ValidationError();
  const day = parseDate(date);
  if (!day) v.add("date", "Date must be YYYY-MM-DD.");
  if (!serviceId) v.add("serviceId", "serviceId is required.");
  v.throwIfAny();
  return day;
}

/** Client status label for a schedule ("Active" | "Inactive"). */
export const scheduleLabel = (status) => (status === "ACTIVE" ? "Active" : "Inactive");

/**
 * Validates a decoded POST /schedules body (see decodeSchedule) with Go's messages and returns the
 * fields to store (times normalised to "HH:MM", default working days Mon-Fri).
 */
export function validateSchedule(input) {
  const v = new ValidationError();
  if (!input.departmentId) v.add("departmentId", "Department is required.");
  const workingDays = input.workingDays && input.workingDays.length > 0 ? input.workingDays : WEEKDAYS.slice(0, 5);
  for (const d of workingDays) {
    if (!WEEKDAYS.includes(d)) v.add("workingDays", `Unknown day ${JSON.stringify(d)} (use Mon..Sun).`);
  }
  const open = parseClock(input.openingTime);
  const closing = parseClock(input.closingTime);
  if (open === null || closing === null || !(closing > open)) {
    v.add("closingTime", "Opening/closing must be HH:MM and closing must be after opening.");
  }
  if (input.dailyCapacity <= 0) v.add("dailyCapacity", "Daily capacity must be positive.");
  if (!parseDate(input.effectiveStartDate)) v.add("effectiveStartDate", "Start date must be YYYY-MM-DD.");
  if (input.effectiveEndDate !== null && input.effectiveEndDate < input.effectiveStartDate) {
    v.add("effectiveEndDate", "End date cannot precede start date.");
  } else if (input.effectiveEndDate !== null && !parseDate(input.effectiveEndDate)) {
    // Go passed this to Postgres unchecked (::date cast failed -> 500); a 422 is clearer.
    v.add("effectiveEndDate", "End date must be YYYY-MM-DD.");
  }
  v.throwIfAny();
  return {
    departmentId: input.departmentId,
    serviceId: input.serviceId,
    workingDays,
    openingTime: hhmm(open),
    closingTime: hhmm(closing),
    dailyCapacity: input.dailyCapacity,
    effectiveStartDate: input.effectiveStartDate,
    effectiveEndDate: input.effectiveEndDate,
  };
}

/** Daily sequential queue token "{DEPT_CODE}-{SEQ:02d}" (e.g. "KBL-01"), as Go's GenerateQueueToken. */
export function queueToken(deptCode, seq) {
  const code = String(deptCode ?? "").trim().toUpperCase() || "WRD";
  const n = seq < 1 ? 1 : seq;
  return `${code}-${pad(n)}`;
}

/** "HH:MM:SS" -> "HH12:MI AM" (Postgres to_char(time, 'HH12:MI AM')); "" for null. */
export function clock12(t) {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  return `${pad(h % 12 || 12)}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}

// ---- Go encoding/json type checks --------------------------------------------------------------
// The Go controllers decoded bodies into typed structs: a value of the wrong JSON type was a 400
// "malformed JSON body: json: cannot unmarshal <kind> into Go struct field <Struct>.<field> of type <T>",
// while null or a missing field left the zero value.

const jsonKind = (v) =>
  typeof v === "string" ? "string" : typeof v === "number" ? "number" : typeof v === "boolean" ? "bool" : Array.isArray(v) ? "array" : "object";

function mismatch(struct, field, value, type) {
  const what = typeof value === "number" ? `number ${value}` : jsonKind(value);
  return new BadRequestError(`malformed JSON body: json: cannot unmarshal ${what} into Go struct field ${struct}.${field} of type ${type}`);
}

/**
 * Decodes body fields like Go's json.Decoder into a struct. spec: {field: type} where type is
 * "string", "*string" (null stays null), "int", "[]string" (null stays null), or a named string type
 * such as "model.QueueStatus".
 */
export function decode(input, struct, spec) {
  const out = {};
  for (const [field, type] of Object.entries(spec)) {
    const v = input[field];
    const pointer = type.startsWith("*");
    if (v === undefined || v === null) {
      out[field] = pointer || type.startsWith("[]") ? null : type === "int" ? 0 : "";
      continue;
    }
    if (type === "int") {
      if (typeof v !== "number" || !Number.isInteger(v)) throw mismatch(struct, field, v, "int");
      out[field] = v;
    } else if (type === "[]string") {
      if (!Array.isArray(v)) throw mismatch(struct, field, v, "[]string");
      out[field] = v.map((e) => {
        if (e === null) return "";
        if (typeof e !== "string") throw mismatch(struct, field, e, "string");
        return e;
      });
    } else {
      const name = pointer ? type.slice(1) : type;
      if (typeof v !== "string") throw mismatch(struct, field, v, name);
      out[field] = v;
    }
  }
  return out;
}

export const decodeSchedule = (input) =>
  decode(input, "ScheduleInput", {
    departmentId: "string", serviceId: "*string", workingDays: "[]string", openingTime: "string",
    closingTime: "string", dailyCapacity: "int", effectiveStartDate: "string", effectiveEndDate: "*string",
  });
export const decodeCheckIn = (input) =>
  decode(input, "CheckInRequest", { appointmentId: "string", verifiedDocuments: "[]string", notes: "string" });
export const decodeCallNext = (input) => decode(input, "CallNextRequest", { counterNumber: "int" });
export const decodeFinalize = (input) => decode(input, "FinalizeRequest", { status: "model.QueueStatus" });
