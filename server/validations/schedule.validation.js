// Operating schedules and slot availability.
import { z } from "zod";
import { validDate } from "../utils/date.js";
import { STATUSES } from "../models/schedule.model.js";
import { WEEKDAYS, clockTime, dateString, queryRequired, requiredText } from "./common.js";

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
