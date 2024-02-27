// /api/v1/schedules (API.md module 5): list for staff, changes for ADMIN, public active list and availability.
// Full paths on an unmounted Router, so req.path (request log) stays the full path.
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";

export function createScheduleRoutes(controller) {
  const router = Router();
  router.get("/api/v1/schedules", requireRole("ADMIN", "OFFICER"), controller.list);
  router.post("/api/v1/schedules", requireRole("ADMIN"), controller.create);
  router.put("/api/v1/schedules/:id", requireRole("ADMIN"), controller.update);
  router.patch("/api/v1/schedules/:id/status", requireRole("ADMIN"), controller.toggleStatus);
  router.delete("/api/v1/schedules/:id", requireRole("ADMIN"), controller.remove);
  // Public: the citizen booking page reads the bookable schedules and slot availability before sign-in.
  router.get("/api/v1/schedules/active", controller.listBookable);
  router.get("/api/v1/schedules/availability", controller.availability);
  return router;
}
