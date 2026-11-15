// Appointments, reports and the audit log.
import { z } from "zod";
import { ACTIONS } from "../models/auditLog.model.js";
import {
  bookingDate, dateString, nullableText, optionalText, pageQuery, phone, queryInt, queryRequired, queryText, queryUpper, requiredText, timeSlot,
} from "./common.js";

export const bookSchema = z.object({
  // Optional: a citizen's booking always uses the full name and phone number of their account
  // (given at sign-up); staff booking on someone's behalf may send them.
  citizenName: requiredText("Citizen name is required (min 3 characters).", 3).optional(),
  citizenPhone: phone.optional(),
  citizenEmail: nullableText.optional(),
  departmentId: optionalText, // taken from the service
  serviceId: requiredText("Service is required."),
  date: bookingDate(),
  timeSlot,
  citizenNotes: nullableText,
});

export const reviewSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"], { error: "Status must be APPROVED or REJECTED." }),
    officerNotes: nullableText,
    rejectionReason: nullableText,
  })
  .refine((u) => u.status !== "REJECTED" || u.rejectionReason !== null, {
    error: "A rejection reason is required.",
    path: ["rejectionReason"],
  });

export const rescheduleSchema = z.object({
  newDate: dateString(),
  newTimeSlot: timeSlot,
  reason: optionalText,
});

export const trackQuery = z.object({ ref: queryRequired("Reference number or phone is required.") });

export const myAppointmentsQuery = z.object({ tab: queryUpper, search: queryText });

/** Registry filters, shared by the list and the CSV export. */
export const registryQuery = z.object({
  timeframe: queryUpper,
  status: queryUpper,
  departmentId: queryText,
  serviceId: queryText,
  search: queryText,
  ...pageQuery,
});

export const summaryQuery = z.object({ period: queryUpper, departmentId: queryText });

/**
 * Audit log keyset cursor: base64url of ["a" | "b", at, id], where "a" asks for the entries after
 * (older than) the row (at, id) and "b" for the entries before (newer than) it. at is the exact
 * timestamp text from the database (microseconds), so no entry is skipped or repeated.
 */
export function encodeAuditCursor(direction, at, id) {
  return Buffer.from(JSON.stringify([direction, at, id])).toString("base64url");
}
const auditCursor = queryText.transform((raw, ctx) => {
  if (raw === "") return null;
  try {
    const [direction, at, id] = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if ((direction === "a" || direction === "b") && typeof at === "string" && !Number.isNaN(Date.parse(at)) && typeof id === "string" && id) {
      return { direction, at, id };
    }
  } catch {
    // fall through to the validation issue
  }
  ctx.addIssue({ code: "custom", message: "Invalid page cursor." });
  return z.NEVER;
});

export const auditQuery = z.object({
  action: queryUpper.transform((a) => (ACTIONS.includes(a) ? a : "")),
  departmentId: queryText,
  search: queryText,
  cursor: auditCursor,
  pageSize: queryInt(5, 1, 100),
});
