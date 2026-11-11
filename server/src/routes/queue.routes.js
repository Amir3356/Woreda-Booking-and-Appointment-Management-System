// /api/v1/queue: the officer desk queue (OFFICER only).
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { boardQuery, callNextSchema, checkInSchema, finalizeSchema } from "../validations/queue.validation.js";

export function createQueueRoutes(c) {
  const router = Router();
  const officer = requireRole("OFFICER");
  router.post("/verify-checkin", officer, validate({ body: checkInSchema }), c.checkIn);
  router.get("/", officer, validate({ query: boardQuery }), c.board);
  router.post("/call-next", officer, validate({ body: callNextSchema }), c.callNext);
  router.patch("/:id/status", officer, validate({ body: finalizeSchema }), c.finalize);
  return router;
}
