// /api/v1/appointments.
import { Router } from "express";
import { checkAbility } from "../middleware/casl.js";
import { Actions, Subjects } from "../security/abilities.js";
import { validate } from "../middleware/validate.js";
import {
  bookSchema, myAppointmentsQuery, registryQuery, rescheduleSchema, reviewSchema, trackQuery,
} from "../validations/appointment.validation.js";

export function createAppointmentRoutes(c) {
  const router = Router();
  const canCreate = checkAbility(Actions.CREATE, Subjects.APPOINTMENT);
  const canReadMine = checkAbility(Actions.READ_MINE, Subjects.APPOINTMENT);
  const canReadRegistry = checkAbility(Actions.READ_REGISTRY, Subjects.APPOINTMENT);
  const canReview = checkAbility(Actions.REVIEW, Subjects.APPOINTMENT);
  const canReschedule = checkAbility(Actions.RESCHEDULE, Subjects.APPOINTMENT);
  const canCancel = checkAbility(Actions.CANCEL, Subjects.APPOINTMENT);

  router.post("/", canCreate, validate({ body: bookSchema }), c.book);
  router.get("/track", validate({ query: trackQuery }), c.track);
  router.get("/my", canReadMine, validate({ query: myAppointmentsQuery }), c.mine);
  router.get("/", canReadRegistry, validate({ query: registryQuery }), c.list);
  router.patch("/:id/status", canReview, validate({ body: reviewSchema }), c.review);
  router.post("/:id/reschedule", canReschedule, validate({ body: rescheduleSchema }), c.reschedule);
  router.post("/:id/cancel", canCancel, c.cancel);
  router.get("/:id/slip", c.slip);
  return router;
}
