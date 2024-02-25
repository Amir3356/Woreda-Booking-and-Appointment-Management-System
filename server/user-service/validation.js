// Pure input handling: Go-style JSON struct decoding and the field rules of the Go service.
import { BadRequestError, ValidationError } from "./lib/index.js";

export const LABEL_OFFICER = "Department Officer";
export const LABEL_ADMIN = "Central Administrator";

const ETHIOPIAN_PHONE = /^\+2519\d{8}$/;
// RFC 5322 addr-spec as Go's net/mail accepts it (dot-atom or quoted local part, UTF-8 allowed).
const ATEXT = "[A-Za-z0-9!#$%&'*+\\-/=?^_`{|}~\\u0080-\\uFFFF]";
const DOT_ATOM = `${ATEXT}+(?:\\.${ATEXT}+)*`;
const QUOTED = '"(?:[^"\\\\\\r\\n]|\\\\.)*"';
const EMAIL = new RegExp(`^(?:${DOT_ATOM}|${QUOTED})@(?:${DOT_ATOM}|\\[[^\\[\\]\\\\]*\\])$`);

const byteLen = (s) => Buffer.byteLength(s, "utf8");

export const isValidEthiopianPhone = (phone) => ETHIOPIAN_PHONE.test(String(phone).trim());

export function isValidEmail(email) {
  const e = String(email).trim();
  if (e === "" || byteLen(e) > 254) return false;
  // mail.ParseAddress(e).Address == e: a bare addr-spec, no display name or comments.
  return EMAIL.test(e);
}

function jsonKind(v) {
  if (typeof v === "number") return "number";
  if (typeof v === "string") return "string";
  if (typeof v === "boolean") return "bool";
  if (Array.isArray(v)) return "array";
  return "object";
}

/**
 * Decodes a JSON object into a Go struct shape: absent or null fields get the zero value,
 * unknown fields are ignored, and a type mismatch is a 400 with encoding/json's message.
 * spec: { field: "string" | "bool" | "int" }
 */
export function decodeStruct(input, structName, spec) {
  const out = {};
  for (const [field, type] of Object.entries(spec)) {
    const v = input[field];
    if (v === undefined || v === null) {
      out[field] = type === "string" ? "" : type === "bool" ? false : 0;
      continue;
    }
    let good = false;
    let kind = jsonKind(v);
    if (type === "string") good = typeof v === "string";
    else if (type === "bool") good = typeof v === "boolean";
    else if (type === "int") {
      good = typeof v === "number" && Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER;
      if (typeof v === "number" && !good) kind = `number ${v}`;
    }
    if (!good) {
      throw new BadRequestError(
        `malformed JSON body: json: cannot unmarshal ${kind} into Go struct field ${structName}.${field} of type ${type}`,
      );
    }
    out[field] = v;
  }
  return out;
}

export const decodeProfile = (input) =>
  decodeStruct(input, "CitizenProfile", { fullName: "string", phone: "string", email: "string", nationalId: "string", address: "string" });

export const decodeProvision = (input) =>
  decodeStruct(input, "ProvisionRequest", { fullName: "string", email: "string", password: "string", role: "string", departmentId: "string" });

export const decodeSettings = (input) =>
  decodeStruct(input, "Settings", {
    woredaName: "string", cityRegion: "string", hotline: "string", emergencyPhone: "string",
    smsGatewayActive: "bool", autoApproveBookings: "bool",
    advanceBookingDays: "int", cancellationCutoffHours: "int", maxParallelSlots: "int",
  });

/** Trims and validates a profile update; returns the profile to save and echo back. */
export function validateProfile(p) {
  const out = { ...p, fullName: p.fullName.trim(), phone: p.phone.trim(), address: p.address.trim() };
  const v = new ValidationError();
  if (byteLen(out.fullName) < 3) v.add("fullName", "Full name is required (min 3 characters).");
  if (!isValidEthiopianPhone(out.phone)) v.add("phone", "Phone number must match valid Ethiopian format (+2519XXXXXXXX).");
  v.throwIfAny();
  return out;
}

/** Validates a provisioning request; returns {fullName, email, password, role, departmentId|null}. */
export function validateProvision(req) {
  const v = new ValidationError();
  let role = null;
  if (req.role === LABEL_OFFICER || req.role === "OFFICER") role = "OFFICER";
  else if (req.role === LABEL_ADMIN || req.role === "ADMIN") role = "ADMIN";
  else v.add("role", 'Role must be "Department Officer" or "Central Administrator".');
  if (byteLen(req.fullName.trim()) < 3) v.add("fullName", "Full name is required (min 3 characters).");
  if (!isValidEmail(req.email)) v.add("email", "A valid email address is required.");
  if (byteLen(req.password) < 8) v.add("password", "Password must be at least 8 characters.");
  let departmentId = null;
  if (req.departmentId !== "") departmentId = req.departmentId;
  else if (role === "OFFICER") v.add("departmentId", "Officers must be assigned to a department.");
  v.throwIfAny();
  return { fullName: req.fullName.trim(), email: req.email.trim(), password: req.password, role, departmentId };
}

/** PUT /admin/settings rules: woredaName required, maxParallelSlots <= 0 falls back to 3. */
export function validateSettings(s) {
  const v = new ValidationError();
  if (s.woredaName.trim() === "") v.add("woredaName", "Woreda name is required.");
  const out = { ...s, maxParallelSlots: s.maxParallelSlots <= 0 ? 3 : s.maxParallelSlots };
  v.throwIfAny();
  return out;
}

/** Cursor paging as Go computed it: pageSize outside 1..100 -> 5, negative cursor -> 0. */
export function pageParams(cursorRaw, pageSizeRaw) {
  const atoi = (s) => (/^[+-]?\d+$/.test(String(s ?? "")) ? Number.parseInt(s, 10) : 0);
  let pageSize = atoi(pageSizeRaw);
  if (pageSize <= 0 || pageSize > 100) pageSize = 5;
  return { cursor: Math.max(atoi(cursorRaw), 0), pageSize };
}

export const cursorMeta = (cursor, pageSize, total) => ({
  current: cursor, pageSize, totalCount: total, hasPrev: cursor > 0, hasNext: cursor + pageSize < total,
});

export function roleLabel(role) {
  if (role === "OFFICER") return LABEL_OFFICER;
  if (role === "ADMIN") return LABEL_ADMIN;
  return role;
}

/** Stored settings document -> API shape (receptionPhone is exposed as emergencyPhone). */
export const settingsView = (d) => ({
  woredaName: d.woredaName, cityRegion: d.cityRegion, hotline: d.hotline, emergencyPhone: d.receptionPhone,
  smsGatewayActive: d.smsGatewayActive, autoApproveBookings: d.autoApproveBookings,
  advanceBookingDays: d.advanceBookingDays, cancellationCutoffHours: d.cancellationCutoffHours,
  maxParallelSlots: d.maxParallelSlots,
});
