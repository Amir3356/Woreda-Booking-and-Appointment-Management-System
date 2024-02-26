// All HTTP routes of booking-service.
import { Router } from "express";
import { createScheduleRoutes } from "./schedule.routes.js";
import { createQueueRoutes } from "./queue.routes.js";

export function createRoutes({ scheduleController, queueController }) {
  const router = Router();
  router.get("/healthz", (_req, res) => res.status(200).end());
  router.use(createScheduleRoutes(scheduleController));
  router.use(createQueueRoutes(queueController));
  return router;
}
