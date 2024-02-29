// /api/v1/audit-logs (ADMIN only): the appointment decision trail.
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";

export function createAuditRoutes(controller) {
  const router = Router();
  router.get("/", requireRole("ADMIN"), controller.list);
  return router;
}
