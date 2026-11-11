// /api/v1/schedules: list for staff, changes for ADMIN, public bookable list and availability.
import { Router } from "express";
import { checkAbility } from "../middleware/casl.js";
import { Actions, Subjects } from "../security/abilities.js";
import { validate } from "../middleware/validate.js";
import { availabilityQuery, scheduleSchema } from "../validations/schedule.validation.js";

export function createScheduleRoutes(c) {
  const router = Router();
  const canReadStaffSchedule = checkAbility(Actions.READ_STAFF_SCHEDULE, Subjects.SCHEDULE);
  const canCreate = checkAbility(Actions.CREATE, Subjects.SCHEDULE);
  const canUpdate = checkAbility(Actions.UPDATE, Subjects.SCHEDULE);
  const canDelete = checkAbility(Actions.DELETE, Subjects.SCHEDULE);
  const body = validate({ body: scheduleSchema });

  // Public: the citizen booking page reads these before sign-in.
  router.get("/active", c.listBookable);
  router.get("/availability", validate({ query: availabilityQuery }), c.availability);
  router.get("/", canReadStaffSchedule, c.list);
  router.post("/", canCreate, body, c.create);
  router.put("/:id", canUpdate, body, c.update);
  router.patch("/:id/status", canUpdate, c.toggleStatus);
  router.delete("/:id", canDelete, c.remove);
  return router;
}
