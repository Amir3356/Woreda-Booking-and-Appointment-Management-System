// /api/v1/appointments (API.md appointment module).
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";

export function createAppointmentRoutes(controller) {
  const router = Router();
  const signedIn = requireRole("CITIZEN", "OFFICER", "ADMIN");
  const citizen = requireRole("CITIZEN");
  const staff = requireRole("OFFICER", "ADMIN");
  // Public route; the service itself requires a signed-in caller (citizenId must name a user).
  router.post("/", controller.book);
  router.get("/track", controller.track);
  router.get("/my", citizen, controller.mine);
  router.get("/", staff, controller.list);
  router.patch("/:id/status", staff, controller.review);
  router.post("/:id/reschedule", signedIn, controller.reschedule);
  router.post("/:id/cancel", signedIn, controller.cancel);
  router.get("/:id/slip", controller.slip);
  return router;
}
