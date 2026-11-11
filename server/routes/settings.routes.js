// /api/v1/admin/settings (ADMIN only).
import { Router } from "express";
import { checkAbility } from "../middleware/casl.js";
import { Actions, Subjects } from "../security/abilities.js";
import { validate } from "../middleware/validate.js";
import { settingsSchema } from "../validations/user.validation.js";

export function createSettingsRoutes(c) {
  const router = Router();
  const canManageSettings = checkAbility(Actions.MANAGE, Subjects.SETTING);
  router.get("/", canManageSettings, c.get);
  router.put("/", canManageSettings, validate({ body: settingsSchema }), c.update);
  return router;
}
