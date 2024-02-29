// Express application: wires repository → service → controller → routes, then the middleware chain
//   JSON body → request log → JWT caller → routes → 404 → error envelope
import express from "express";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { authenticate } from "./middleware/auth.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { httpMetrics } from "./middleware/metrics.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { createScheduleService } from "./services/schedule.service.js";
import { createAvailabilityService } from "./services/availability.service.js";
import { createQueueService } from "./services/queue.service.js";
import { createScheduleController } from "./controllers/schedule.controller.js";
import { createQueueController } from "./controllers/queue.controller.js";
import { createRoutes } from "./routes/index.js";

export function createApp({ events, catalogEvents }) {
  const scheduleService = createScheduleService({ events: catalogEvents });
  const availabilityService = createAvailabilityService();
  const queueService = createQueueService({ events });

  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger(logger));
  app.use(httpMetrics());
  app.use(authenticate(config.jwtSecret));
  app.use(createRoutes({
    scheduleController: createScheduleController({ scheduleService, availabilityService }),
    queueController: createQueueController(queueService),
  }));
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
