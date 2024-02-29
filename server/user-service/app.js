// Express application: wires repository → service → controller → routes, then the middleware chain
//   JSON body → request log → JWT caller → routes → 404 → error envelope
import express from "express";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { authenticate } from "./middleware/auth.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { httpMetrics } from "./middleware/metrics.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { createProfileService } from "./services/profile.service.js";
import { createStaffService } from "./services/staff.service.js";
import { createSettingsService } from "./services/settings.service.js";
import { createProfileController } from "./controllers/profile.controller.js";
import { createStaffController } from "./controllers/staff.controller.js";
import { createSettingsController } from "./controllers/settings.controller.js";
import { createRoutes } from "./routes/index.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger(logger));
  app.use(httpMetrics());
  app.use(authenticate(config.jwtSecret));
  app.use(createRoutes({
    profileController: createProfileController(createProfileService()),
    staffController: createStaffController(createStaffService()),
    settingsController: createSettingsController(createSettingsService()),
  }));
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
