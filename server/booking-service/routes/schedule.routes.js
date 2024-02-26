// /api/v1/schedules (API.md module 5): list for staff, create for ADMIN, public availability.
// Full paths on an unmounted Router, so req.path (request log) stays the full path.
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";

export function createScheduleRoutes(controller) {
  const router = Router();
  router.get("/api/v1/schedules", requireRole("ADMIN", "OFFICER"), controller.list);
  router.post("/api/v1/schedules", requireRole("ADMIN"), controller.create);
  // Public: the citizen booking page shows slot availability before sign-in.
  router.get("/api/v1/schedules/availability", controller.availability);
  return router;
}
