// /api/v1/citizen/profile (CITIZEN only).
import { Router } from "express";
import { checkAbility } from "../middleware/casl.js";
import { Actions, Subjects } from "../security/abilities.js";
import { validate } from "../middleware/validate.js";
import { profileSchema } from "../validations/user.validation.js";

export function createProfileRoutes(c) {
  const router = Router();
  const canReadProfile = checkAbility(Actions.READ, Subjects.PROFILE);
  const canUpdateProfile = checkAbility(Actions.UPDATE, Subjects.PROFILE);
  router.get("/", canReadProfile, c.get);
  router.put("/", canUpdateProfile, validate({ body: profileSchema }), c.update);
  return router;
}
