// Appointments, reports and the audit log.
import { z } from "zod";
import { ACTIONS } from "../models/auditLog.model.js";
import {
  bookingDate, dateString, nullableText, optionalText, pageQuery, phone, queryRequired, queryText, queryUpper, requiredText, timeSlot,
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
  search: queryText,
  ...pageQuery,
});

export const summaryQuery = z.object({ period: queryUpper, departmentId: queryText });

export const auditQuery = z.object({
  action: queryUpper.transform((a) => (ACTIONS.includes(a) ? a : "")),
  departmentId: queryText,
  search: queryText,
  ...pageQuery,
});
