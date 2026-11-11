// /api/v1/admin/users (ADMIN only).
import { Router } from "express";
import { checkAbility } from "../middleware/casl.js";
import { Actions, Subjects } from "../security/abilities.js";
import { validate } from "../middleware/validate.js";
import { provisionSchema, staffListQuery } from "../validations/user.validation.js";

export function createStaffRoutes(c) {
  const router = Router();
  const canManageStaff = checkAbility(Actions.MANAGE, Subjects.STAFF);
  router.get("/", canManageStaff, validate({ query: staffListQuery }), c.list);
  router.get("/citizens", canManageStaff, validate({ query: staffListQuery }), c.listCitizens);
  router.post("/provision", canManageStaff, validate({ body: provisionSchema }), c.provision);
  router.patch("/:id/status", canManageStaff, c.toggleStatus);
  router.delete("/:id", canManageStaff, c.remove);
  return router;
}
