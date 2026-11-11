// /api/v1/auth request bodies.
import { z } from "zod";
import { optionalText, phone, requiredText } from "./common.js";

const PASSWORD = "Password must be at least 8 characters and include a digit or symbol.";
const EMAIL = "A valid email address is required.";

// Citizens register with their phone number; email is optional.
export const registerSchema = z.object({
  fullName: requiredText("Full name is required (min 3 characters).", 3),
  phone,
  email: z.string().trim().nullish().transform((v) => (v ? v : null))
    .refine((v) => v === null || v.includes("@"), { error: EMAIL }),
  // At least 8 characters and one digit, punctuation mark or symbol.
  password: z.string({ error: PASSWORD }).min(8, { error: PASSWORD }).regex(/[\p{Nd}\p{P}\p{S}]/u, { error: PASSWORD }),
  nationalId: optionalText, // optional; the sign-up form does not ask for it
  // Where the citizen lives: stored together as the account's address.
  location: requiredText("Location is required (e.g. Addis Ababa, Bole Sub-City)."),
  woreda: requiredText("Woreda is required."),
  kebele: requiredText("Kebele is required."),
  houseNumber: optionalText,
});

// Staff sign in with their email, citizens with their phone number: send one of the two.
export const loginSchema = z
  .object({
    email: z.string().trim().nullish().transform((v) => (v ? v : null)),
    phone: z.string().nullish().transform((v) => (v && v.trim() ? v : null))
      .pipe(z.union([z.null(), phone])),
    password: z.string({ error: "Password is required." }).min(1, { error: "Password is required." }),
  })
  .refine((v) => v.email !== null || v.phone !== null, {
    error: "Enter your email address or phone number.",
    path: ["email"],
  });
