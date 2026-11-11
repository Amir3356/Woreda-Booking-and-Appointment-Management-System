// The officer desk queue.
import { z } from "zod";
import { optionalText, queryText, requiredText } from "./common.js";

export const checkInSchema = z.object({
  appointmentId: requiredText("Appointment id is required."),
  verifiedDocuments: z.array(z.string()).nullish().transform((v) => v ?? []),
  notes: optionalText,
});

export const callNextSchema = z.object({
  counterNumber: z.number({ error: "Counter number must be positive." }).int({ error: "Counter number must be a whole number." })
    .positive({ error: "Counter number must be positive." }),
});

export const finalizeSchema = z.object({
  status: z.enum(["COMPLETED", "NO_SHOW"], { error: "Status must be COMPLETED or NO_SHOW." }),
});

export const boardQuery = z.object({ departmentId: queryText });
