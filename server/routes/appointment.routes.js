// /api/v1/appointments.
import { Router } from "express";
import { requireRole, signedIn } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  bookSchema, myAppointmentsQuery, registryQuery, rescheduleSchema, reviewSchema, trackQuery,
} from "../validations/appointment.validation.js";

export function createAppointmentRoutes(c) {
  const router = Router();
  const citizen = requireRole("CITIZEN");
  const staff = requireRole("OFFICER", "ADMIN");
  // Public route; the service itself requires a signed-in caller (401 before validation errors would be confusing).
  router.post("/", signedIn, validate({ body: bookSchema }), c.book);
  router.get("/track", validate({ query: trackQuery }), c.track);
  router.get("/my", citizen, validate({ query: myAppointmentsQuery }), c.mine);
  router.get("/", staff, validate({ query: registryQuery }), c.list);
  router.patch("/:id/status", staff, validate({ body: reviewSchema }), c.review);
  router.post("/:id/reschedule", signedIn, validate({ body: rescheduleSchema }), c.reschedule);
  router.post("/:id/cancel", signedIn, c.cancel);
  router.get("/:id/slip", c.slip);
  return router;
}
