// Pure appointment rules: validation, formats and date math (ported from the Go service package).
import { randomInt } from "node:crypto";
import { BadRequestError, ValidationError } from "./lib/index.js";

const ethiopianPhone = /^\+2519\d{8}$/;
// Client slot format, e.g. "09:00 AM", "13:30 PM" (24h hour + AM/PM suffix as in the UI).
const timeSlotPattern = /^\d{2}:\d{2} (AM|PM)$/;

export const isTimeSlot = (s) => timeSlotPattern.test(s);

/** Strict YYYY-MM-DD with a real calendar day (Go time.Parse(time.DateOnly)). */
export function validDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Trimmed value, or null when blank (Go's optional()). */
export const optional = (s) => (s.trim() === "" ? null : s.trim());
/** NULLIF(s, '') */
export const nullIfEmpty = (s) => (s === "" ? null : s);

/** Reads string fields like Go's JSON decoder into a struct of strings: missing/null -> "", other types -> 400. */
export function strings(input, keys) {
  const out = {};
  for (const k of keys) {
    const v = input[k];
    if (v == null) out[k] = "";
    else if (typeof v === "string") out[k] = v;
    else throw new BadRequestError(`malformed JSON body: json: cannot unmarshal ${jsonType(v)} into field ${k} of type string`);
  }
  return out;
}
const jsonType = (v) => (Array.isArray(v) ? "array" : typeof v === "object" ? "object" : typeof v);

export const BOOK_FIELDS = ["citizenName", "citizenPhone", "citizenEmail", "departmentId", "serviceId", "date", "timeSlot", "citizenNotes"];

export function validateBooking(req, todayStr) {
  const v = new ValidationError();
  if (req.citizenName.trim().length < 3) v.add("citizenName", "Citizen name is required (min 3 characters).");
  if (!ethiopianPhone.test(req.citizenPhone)) v.add("citizenPhone", "Phone number must match valid Ethiopian format (+2519XXXXXXXX).");
  if (req.serviceId === "") v.add("serviceId", "Service is required.");
  if (!validDate(req.date)) v.add("date", "Date must be YYYY-MM-DD.");
  else if (req.date < todayStr) v.add("date", "Date cannot be in the past.");
  if (!isTimeSlot(req.timeSlot)) v.add("timeSlot", 'Time slot must look like "09:00 AM".');
  v.throwIfAny();
}

export function validateReview(u) {
  const v = new ValidationError();
  if (u.status !== "APPROVED" && u.status !== "REJECTED") v.add("status", "Status must be APPROVED or REJECTED.");
  if (u.status === "REJECTED" && u.rejectionReason.trim() === "") v.add("rejectionReason", "A rejection reason is required.");
  v.throwIfAny();
}

export function validateReschedule(req) {
  const v = new ValidationError();
  if (!validDate(req.newDate)) v.add("newDate", "Date must be YYYY-MM-DD.");
  if (!isTimeSlot(req.newTimeSlot)) v.add("newTimeSlot", 'Time slot must look like "09:00 AM".');
  v.throwIfAny();
}

/** Public tracker stage (0 Submitted, 1 Approved, 2 Checked In, 3 In Progress, 4 Delivered). */
export function stageIndex(status) {
  return { APPROVED: 1, CHECKED_IN: 2, IN_PROGRESS: 3, COMPLETED: 4 }[status] ?? 0;
}

/** Statuses that occupy a place in their time slot (Go counted status NOT IN ('CANCELLED','REJECTED')). */
export const holdsPlace = (status) => status !== "CANCELLED" && status !== "REJECTED";

export const slotKey = (serviceId, date, timeSlot) => `${serviceId}|${date}|${timeSlot}`;

/** "WRD-YYYYMMDD-XXXX" with XXXX in 1000..9999, e.g. "WRD-20261102-4821". */
export function referenceNumber(todayStr) {
  return `WRD-${todayStr.replaceAll("-", "")}-${1000 + randomInt(9000)}`;
}

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

/** Integer percentages as Go computed them (truncating division). */
export function withRates(s) {
  const total = s.totalAppointments;
  return {
    ...s,
    completionRate: total > 0 ? Math.trunc((s.completedAppointments * 100) / total) : 0,
    noShowRate: total > 0 ? Math.trunc((s.noShowAppointments * 100) / total) : 0,
  };
}

/** strconv.Atoi semantics: anything but an optionally signed integer is 0. */
export const atoi = (s) => (/^[+-]?\d+$/.test(String(s ?? "")) ? Number.parseInt(s, 10) : 0);

/** Page/limit defaults from the Go service: page >= 1, limit 1..200 else 20. */
export function normalizePage(page, limit) {
  return { page: page < 1 ? 1 : page, limit: limit < 1 || limit > 200 ? 20 : limit };
}

export function pagination(total, page, limit) {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return { totalItems: total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

// ---- CSV (Go encoding/csv) ---------------------------------------------------------------

function csvField(field) {
  const needsQuotes = field !== "" && (field === "\\." || /[",\r\n]/.test(field) || /^\s/u.test(field));
  return needsQuotes ? `"${field.replaceAll('"', '""')}"` : field;
}

export const CSV_HEADER = ["Reference", "Citizen", "Phone", "Department", "Service", "Date", "Time Slot", "Status"];

export function appointmentsCsv(list) {
  const rows = [CSV_HEADER, ...list.map((a) => [
    a.referenceNumber, a.citizenName, a.citizenPhone, a.departmentName, a.serviceName, a.date, a.timeSlot, a.status,
  ])];
  return rows.map((r) => r.map((f) => csvField(String(f ?? ""))).join(",") + "\n").join("");
}
