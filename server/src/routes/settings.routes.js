// /api/v1/admin/settings (ADMIN only).
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { settingsSchema } from "../validations/user.validation.js";

export function createSettingsRoutes(c) {
  const router = Router();
  const admin = requireRole("ADMIN");
  router.get("/", admin, c.get);
  router.put("/", admin, validate({ body: settingsSchema }), c.update);
  return router;
}
