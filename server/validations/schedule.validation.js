// Operating schedules and slot availability.
import { z } from "zod";
import { hhmm, parseClock, validDate } from "../utils/date.js";
import { daySpan } from "../utils/calendar.js";
import { STATUSES } from "../models/schedule.model.js";
import { EXCEPTION_TYPES, SCOPES } from "../models/calendar.model.js";
import { WEEKDAYS, clockTime, dateString, queryRequired, queryText, requiredText } from "./common.js";

export const scheduleSchema = z
  .object({
    departmentId: requiredText("Department is required."),
    // Blank = department-wide schedule.
    serviceId: z.string().trim().nullish().transform((v) => (v ? v : null)),
    // Empty = Monday to Friday.
    workingDays: z
      .array(z.enum(WEEKDAYS, { error: "Unknown day (use Mon..Sun)." }), { error: "Working days must be a list." })
      .nullish()
      .transform((v) => (v && v.length > 0 ? v : WEEKDAYS.slice(0, 5))),
    openingTime: clockTime("Opening time must be HH:MM."),
    closingTime: clockTime("Closing time must be HH:MM."),
    dailyCapacity: z.number({ error: "Daily capacity must be positive." }).int({ error: "Daily capacity must be a whole number." })
      .positive({ error: "Daily capacity must be positive." }),
    effectiveStartDate: dateString("Start date must be YYYY-MM-DD."),
    effectiveEndDate: z.string().trim().nullish().transform((v) => (v ? v : null))
      .refine((v) => v === null || validDate(v), { error: "End date must be YYYY-MM-DD." }),
    // "Active"/"Inactive" from the form, or the stored codes; absent keeps the current status.
    status: z.string().nullish().transform((v) => (v ? v.toUpperCase() : null))
      .refine((v) => v === null || STATUSES.includes(v), { error: "Status must be Active or Inactive." }),
  })
  .refine((s) => s.closingTime > s.openingTime, { error: "Closing time must be after opening time.", path: ["closingTime"] })
  .refine((s) => s.effectiveEndDate === null || s.effectiveEndDate >= s.effectiveStartDate, {
    error: "End date cannot precede start date.",
    path: ["effectiveEndDate"],
  });

export const availabilityQuery = z.object({
  serviceId: queryRequired("serviceId is required."),
  date: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), dateString()),
});

// ---- Schedule Management: calendar exceptions, booking availability, capacities, calendar views ----

const MAX_RANGE_DAYS = 366;
const MAX_VIEW_DAYS = 92;
const span = (from, to) => daySpan(from, to);
const optionalDate = (message) =>
  z.string().trim().nullish().transform((v) => (v ? v : null)).refine((v) => v === null || validDate(v), { error: message });
const idList = (message) =>
  z.array(z.string().trim().min(1), { error: message }).nullish().transform((v) => [...new Set(v ?? [])]);
const optionalClock = (message) =>
  z.string().trim().nullish().transform((v) => (v ? v : null))
    .refine((v) => v === null || parseClock(v) !== null, { error: message })
    .transform((v) => (v === null ? null : hhmm(parseClock(v))));

export const exceptionSchema = z
  .object({
    type: z.enum(EXCEPTION_TYPES, { error: "Choose the kind of exception." }),
    title: requiredText("Give the exception a name or reason.").pipe(z.string().max(120, { error: "Keep the name under 120 characters." })),
    description: z.string().trim().max(1000, { error: "Keep the description under 1000 characters." }).nullish().transform((v) => (v ? v : null)),
    startDate: dateString("Start date must be YYYY-MM-DD."),
    endDate: optionalDate("End date must be YYYY-MM-DD."),
    scope: z.enum(SCOPES, { error: "Choose which departments the exception applies to." }),
    departmentIds: idList("Departments must be a list."),
    openingTime: optionalClock("Opening time must be HH:MM."),
    closingTime: optionalClock("Closing time must be HH:MM."),
    dailyCapacity: z.number({ error: "Daily capacity must be a whole number." }).int({ error: "Daily capacity must be a whole number." })
      .positive({ error: "Daily capacity must be positive." }).max(10000, { error: "Daily capacity is too large." }).nullish()
      .transform((v) => v ?? null),
  })
  .transform((e) => ({
    ...e,
    endDate: e.endDate ?? e.startDate,
    departmentIds: e.scope === "ALL" ? [] : e.departmentIds,
    // Only exceptional working days carry hours and capacity.
    ...(e.type === "WORKING_DAY" ? {} : { openingTime: null, closingTime: null, dailyCapacity: null }),
  }))
  .superRefine((e, ctx) => {
    if (e.endDate < e.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date cannot precede start date." });
    else if (span(e.startDate, e.endDate) > MAX_RANGE_DAYS) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: `An exception can cover at most ${MAX_RANGE_DAYS} days.` });
    }
    if (e.scope === "DEPARTMENT" && e.departmentIds.length !== 1) {
      ctx.addIssue({ code: "custom", path: ["departmentIds"], message: "Choose exactly one department." });
    }
    if (e.scope === "DEPARTMENTS" && e.departmentIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["departmentIds"], message: "Choose at least one department." });
    }
    if (e.type === "WORKING_DAY") {
      if (!e.openingTime) ctx.addIssue({ code: "custom", path: ["openingTime"], message: "An exceptional working day needs an opening time." });
      if (!e.closingTime) ctx.addIssue({ code: "custom", path: ["closingTime"], message: "An exceptional working day needs a closing time." });
      if (e.openingTime && e.closingTime && e.closingTime <= e.openingTime) {
        ctx.addIssue({ code: "custom", path: ["closingTime"], message: "Closing time must be after opening time." });
      }
      if (e.dailyCapacity === null) {
        ctx.addIssue({ code: "custom", path: ["dailyCapacity"], message: "An exceptional working day needs a daily appointment capacity." });
      }
    }
  });

export const dateAvailabilitySchema = z
  .object({
    departmentIds: z.array(z.string().trim().min(1), { error: "Departments must be a list." })
      .min(1, { error: "Choose at least one department." }).transform((v) => [...new Set(v)]),
    startDate: dateString("Start date must be YYYY-MM-DD."),
    endDate: optionalDate("End date must be YYYY-MM-DD."),
    enabled: z.boolean({ error: "Say whether booking is enabled (true) or disabled (false)." }),
    reason: z.string().trim().max(200, { error: "Keep the reason under 200 characters." }).nullish().transform((v) => (v ? v : null)),
  })
  .transform((a) => ({ ...a, endDate: a.endDate ?? a.startDate }))
  .superRefine((a, ctx) => {
    if (a.endDate < a.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date cannot precede start date." });
    else if (span(a.startDate, a.endDate) > MAX_RANGE_DAYS) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: `Choose at most ${MAX_RANGE_DAYS} days at a time.` });
    }
  });

export const capacitySchema = z.object({
  // null removes the department limit (only the per-service limits apply).
  dailyCapacity: z.number({ error: "Daily capacity must be a whole number." }).int({ error: "Daily capacity must be a whole number." })
    .positive({ error: "Daily capacity must be positive." }).max(10000, { error: "Daily capacity is too large." }).nullable(),
});

const rangeQuery = (maxDays) =>
  z
    .object({
      from: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), dateString("from must be YYYY-MM-DD.")),
      to: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), dateString("to must be YYYY-MM-DD.")),
    })
    .refine((q) => q.to >= q.from, { error: "to cannot precede from.", path: ["to"] })
    .refine((q) => q.to < q.from || span(q.from, q.to) <= maxDays, { error: `Choose at most ${maxDays} days.`, path: ["to"] });

/** departmentIds=a,b (or repeated): absent = every department. */
const queryIdList = z.preprocess(
  (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []).map((s) => String(s).trim()).filter(Boolean),
  z.array(z.string()),
);

export const calendarQuery = rangeQuery(MAX_VIEW_DAYS).and(z.object({ departmentId: queryText }));
export const exceptionListQuery = z.object({
  from: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.string().optional()).transform((v) => (v && validDate(v) ? v : null)),
  to: z.preprocess((v) => (Array.isArray(v) ? v[0] : v), z.string().optional()).transform((v) => (v && validDate(v) ? v : null)),
  departmentId: queryText,
  type: queryText.transform((v) => v.toUpperCase()).refine((v) => v === "" || EXCEPTION_TYPES.includes(v), { error: "Unknown exception type." }),
});
export const impactQuery = rangeQuery(MAX_RANGE_DAYS).and(z.object({ departmentIds: queryIdList }));
export const bookableDatesQuery = rangeQuery(MAX_VIEW_DAYS).and(z.object({ serviceId: queryRequired("serviceId is required.") }));
