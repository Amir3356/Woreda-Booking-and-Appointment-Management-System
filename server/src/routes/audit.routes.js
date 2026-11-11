// /api/v1/audit-logs (ADMIN only): the appointment decision trail.
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { auditQuery } from "../validations/appointment.validation.js";

export function createAuditRoutes(c) {
  const router = Router();
  router.get("/", requireRole("ADMIN"), validate({ query: auditQuery }), c.list);
  return router;
}
