// /api/v1/citizen/profile (CITIZEN only).
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { profileSchema } from "../validations/user.validation.js";

export function createProfileRoutes(c) {
  const router = Router();
  const citizen = requireRole("CITIZEN");
  router.get("/", citizen, c.get);
  router.put("/", citizen, validate({ body: profileSchema }), c.update);
  return router;
}
