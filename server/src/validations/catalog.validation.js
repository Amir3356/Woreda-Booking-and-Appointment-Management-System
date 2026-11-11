// Departments and public services.
import { z } from "zod";
import { optionalText, positiveInt, queryBoolean, queryText, requiredText } from "./common.js";

export const departmentSchema = z.object({
  name: requiredText("Department name is required."),
  code: requiredText("Code is required (max 16 characters).").max(16, { error: "Code is required (max 16 characters)." }).toUpperCase(),
  description: optionalText,
  buildingRoom: requiredText("Building/room is required."),
  contactPhone: requiredText("Contact phone is required."),
});

export const departmentListQuery = z.object({ isActive: queryBoolean });

export const publicServiceSchema = z.object({
  departmentId: requiredText("Parent department is required."),
  name: requiredText("Service name is required."),
  code: requiredText("Service code is required.").toUpperCase(),
  description: optionalText,
  durationMinutes: positiveInt(30, "Duration must be a positive whole number of minutes."),
  dailyQuota: positiveInt(40, "Daily quota must be a positive whole number."),
  feeETB: z.preprocess((v) => (v == null || v === "" ? 0 : v), z.coerce.number({ error: "Fee must be a number." }).min(0, { error: "Fee cannot be negative." })),
  processingDays: optionalText.transform((v) => v || "Same day"),
  requiredDocuments: z.array(z.string().trim(), { error: "Required documents must be a list of text." }).nullish().transform((v) => v ?? []),
});

export const publicServiceListQuery = z.object({
  departmentId: queryText,
  search: queryText,
  isActive: queryBoolean,
});
