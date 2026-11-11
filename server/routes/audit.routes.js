// /api/v1/audit-logs (ADMIN only): the appointment decision trail.
import { Router } from "express";
import { checkAbility } from "../middleware/casl.js";
import { Actions, Subjects } from "../security/abilities.js";
import { validate } from "../middleware/validate.js";
import { auditQuery } from "../validations/appointment.validation.js";

export function createAuditRoutes(c) {
  const router = Router();
  router.get("/", checkAbility(Actions.READ, Subjects.AUDIT), validate({ query: auditQuery }), c.list);
  return router;
}
