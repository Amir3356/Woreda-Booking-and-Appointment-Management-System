// Citizen profile, staff accounts and system settings.
import { z } from "zod";
import { optionalBoolean, optionalInt, optionalText, phone, queryInt, queryText, requiredText } from "./common.js";

export const profileSchema = z.object({
  fullName: requiredText("Full name is required (min 3 characters).", 3),
  phone,
  email: requiredText("A valid email address is required.").pipe(z.email({ error: "A valid email address is required." })),
  nationalId: optionalText,
  address: optionalText,
});

const ROLE = 'Role must be "Department Officer" or "Central Administrator".';

export const provisionSchema = z
  .object({
    fullName: requiredText("Full name is required (min 3 characters).", 3),
    email: requiredText("A valid email address is required.").pipe(z.email({ error: "A valid email address is required." })),
    password: z.string({ error: "Password must be at least 8 characters." }).min(8, { error: "Password must be at least 8 characters." }),
    // The admin form sends the label; the role code is accepted too.
    role: z
      .enum(["Department Officer", "Central Administrator", "OFFICER", "ADMIN"], { error: ROLE })
      .transform((r) => (r === "Department Officer" || r === "OFFICER" ? "OFFICER" : "ADMIN")),
    departmentId: z.string().trim().nullish().transform((v) => (v ? v : null)),
  })
  .refine((s) => s.role !== "OFFICER" || s.departmentId !== null, {
    error: "Officers must be assigned to a department.",
    path: ["departmentId"],
  });

export const staffListQuery = z.object({
  search: queryText,
  cursor: queryInt(0, 0, Number.MAX_SAFE_INTEGER),
  pageSize: queryInt(5, 1, 100),
});

export const settingsSchema = z.object({
  woredaName: requiredText("Woreda name is required."),
  cityRegion: optionalText,
  hotline: optionalText,
  emergencyPhone: optionalText,
  smsGatewayActive: optionalBoolean,
  autoApproveBookings: optionalBoolean,
  advanceBookingDays: optionalInt(0),
  cancellationCutoffHours: optionalInt(0),
  // 0 or less falls back to the default of 3.
  maxParallelSlots: optionalInt(0).transform((v) => (v <= 0 ? 3 : v)),
});
