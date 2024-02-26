// /api/v1/queue (API.md module 6): the officer desk queue.
// Full paths on an unmounted Router, so req.path (request log) stays the full path.
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";

export function createQueueRoutes(controller) {
  const router = Router();
  const officer = requireRole("OFFICER");
  router.post("/api/v1/queue/verify-checkin", officer, controller.checkIn);
  router.get("/api/v1/queue", officer, controller.board);
  router.post("/api/v1/queue/call-next", officer, controller.callNext);
  router.patch("/api/v1/queue/:id/status", officer, controller.finalize);
  return router;
}
