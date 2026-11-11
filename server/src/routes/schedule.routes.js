// /api/v1/schedules: list for staff, changes for ADMIN, public bookable list and availability.
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { availabilityQuery, scheduleSchema } from "../validations/schedule.validation.js";

export function createScheduleRoutes(c) {
  const router = Router();
  const admin = requireRole("ADMIN");
  const body = validate({ body: scheduleSchema });
  // Public: the citizen booking page reads these before sign-in.
  router.get("/active", c.listBookable);
  router.get("/availability", validate({ query: availabilityQuery }), c.availability);
  router.get("/", requireRole("ADMIN", "OFFICER"), c.list);
  router.post("/", admin, body, c.create);
  router.put("/:id", admin, body, c.update);
  router.patch("/:id/status", admin, c.toggleStatus);
  router.delete("/:id", admin, c.remove);
  return router;
}
