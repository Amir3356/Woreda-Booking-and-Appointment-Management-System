// /api/v1/schedules. Schedule Management is administrator-only: reads need READ_STAFF_SCHEDULE and
// changes create/update/delete on Schedule (CASL gives both only to ADMIN). Public: bookable list,
// slots, bookable dates.
import { Router } from "express";
import { checkAbility } from "../middleware/casl.js";
import { Actions, Subjects } from "../security/abilities.js";
import { validate } from "../middleware/validate.js";
import {
  availabilityQuery, bookableDatesQuery, calendarQuery, exceptionListQuery,
  exceptionSchema, impactQuery, scheduleListQuery, scheduleSchema,
} from "../validations/schedule.validation.js";

export function createScheduleRoutes(c) {
  const router = Router();
  const canRead = checkAbility(Actions.READ_STAFF_SCHEDULE, Subjects.SCHEDULE);
  const canCreate = checkAbility(Actions.CREATE, Subjects.SCHEDULE);
  const canUpdate = checkAbility(Actions.UPDATE, Subjects.SCHEDULE);
  const canDelete = checkAbility(Actions.DELETE, Subjects.SCHEDULE);

  // Public: the citizen booking page reads these before sign-in.
  router.get("/active", c.listBookable);
  router.get("/availability", validate({ query: availabilityQuery }), c.availability);
  router.get("/bookable-dates", validate({ query: bookableDatesQuery }), c.bookableDates);

  // Schedule Management (registered before "/:id").
  router.get("/calendar", canRead, validate({ query: calendarQuery }), c.calendar);
  router.get("/impact", canUpdate, validate({ query: impactQuery }), c.impact);
  router.get("/exceptions", canRead, validate({ query: exceptionListQuery }), c.listExceptions);
  router.post("/exceptions", canCreate, validate({ body: exceptionSchema }), c.createException);
  router.put("/exceptions/:id", canUpdate, validate({ body: exceptionSchema }), c.updateException);
  router.delete("/exceptions/:id", canDelete, c.removeException);

  // Operating hours.
  const body = validate({ body: scheduleSchema });
  router.get("/", canRead, validate({ query: scheduleListQuery }), c.list);
  router.post("/", canCreate, body, c.create);
  router.put("/:id", canUpdate, body, c.update);
  router.patch("/:id/status", canUpdate, c.toggleStatus);
  router.delete("/:id", canDelete, c.remove);
  return router;
}
