// Departments and public services.
import { z } from "zod";
import { optionalText, positiveInt, queryBoolean, queryText, requiredText } from "./common.js";

export const departmentSchema = z.object({
  name: requiredText("Department name is required."),
  code: requiredText("Code is required (max 16 characters).").max(16, { error: "Code is required (max 16 characters)." }).toUpperCase(),
  description: optionalText,
  buildingRoom: requiredText("Building/room is required."),
  contactPhone: requiredText("Contact phone is required."),
  serviceIds: z.preprocess(
    (v) => (typeof v === "string" ? [v] : v == null ? [] : v),
    z.array(z.string().trim())
  ).optional().default([]),
});

export const departmentListQuery = z.object({
  departmentId: queryText,
  isActive: queryBoolean,
  status: queryText,
  search: queryText,
  cursor: z.preprocess((v) => (v === undefined || v === "" || v === null ? undefined : Number(Array.isArray(v) ? v[0] : v)), z.number().int().min(0).optional()),
  pageSize: z.preprocess((v) => (v === undefined || v === "" || v === null ? undefined : Number(Array.isArray(v) ? v[0] : v)), z.number().int().min(1).max(100).optional()),
});

export const publicServiceSchema = z.object({
  departmentId: optionalText.nullish().transform((v) => v || null),
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
  status: queryText,
  cursor: z.preprocess((v) => (v === undefined || v === "" || v === null ? undefined : Number(Array.isArray(v) ? v[0] : v)), z.number().int().min(0).optional()),
  pageSize: z.preprocess((v) => (v === undefined || v === "" || v === null ? undefined : Number(Array.isArray(v) ? v[0] : v)), z.number().int().min(1).max(100).optional()),
});
