// /api/v1/queue: the officer desk queue (OFFICER only).
import { Router } from "express";
import { checkAbility } from "../middleware/casl.js";
import { Actions, Subjects } from "../security/abilities.js";
import { validate } from "../middleware/validate.js";
import { boardQuery, callNextSchema, checkInSchema, finalizeSchema } from "../validations/queue.validation.js";

export function createQueueRoutes(c) {
  const router = Router();
  const canManageQueue = checkAbility(Actions.MANAGE, Subjects.QUEUE);
  router.post("/verify-checkin", canManageQueue, validate({ body: checkInSchema }), c.checkIn);
  router.get("/", canManageQueue, validate({ query: boardQuery }), c.board);
  router.post("/call-next", canManageQueue, validate({ body: callNextSchema }), c.callNext);
  router.patch("/:id/status", canManageQueue, validate({ body: finalizeSchema }), c.finalize);
  return router;
}
