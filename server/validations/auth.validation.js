// /api/v1/auth request bodies.
import { z } from "zod";
import { optionalText, phone, requiredText } from "./common.js";

const PASSWORD = "Password must be at least 8 characters and include a digit or symbol.";
const EMAIL = "A valid email address is required.";

export const registerSchema = z.object({
  fullName: requiredText("Full name is required (min 3 characters).", 3),
  email: z.string({ error: EMAIL }).trim().refine((s) => s.includes("@"), { error: EMAIL }),
  phone,
  // At least 8 characters and one digit, punctuation mark or symbol.
  password: z.string({ error: PASSWORD }).min(8, { error: PASSWORD }).regex(/[\p{Nd}\p{P}\p{S}]/u, { error: PASSWORD }),
  nationalId: optionalText, // optional; the sign-up form does not ask for it
  kebele: optionalText,
  houseNumber: optionalText,
});

export const loginSchema = z.object({
  email: requiredText("Email is required."),
  password: z.string({ error: "Password is required." }).min(1, { error: "Password is required." }),
});
