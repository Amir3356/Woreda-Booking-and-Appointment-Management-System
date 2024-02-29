// Express application: wires repository → service → controller → routes, then the middleware chain
//   JSON body → request log → JWT caller → routes → 404 → error envelope
import express from "express";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { authenticate } from "./middleware/auth.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { httpMetrics } from "./middleware/metrics.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { createSessionRepository } from "./repositories/session.repository.js";
import { createAuthService } from "./services/auth.service.js";
import { createAuthController } from "./controllers/auth.controller.js";
import { createRoutes } from "./routes/index.js";

/** redis may be null (REDIS_URL unset): logout does not revoke tokens and login lockout is off. */
export function createApp({ redis }) {
  const sessions = redis ? createSessionRepository(redis) : null;
  const authService = createAuthService({ sessions, jwtSecret: config.jwtSecret, logger });

  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger(logger));
  app.use(httpMetrics());
  app.use(authenticate(config.jwtSecret));
  app.use(createRoutes({ authController: createAuthController(authService) }));
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
