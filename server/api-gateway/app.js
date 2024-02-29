// Express application: wires repositories → services → controllers → routes, then the middleware chain
//   request id → request log → CORS → auth → cache → routes (health / 301 / 404 / proxy)
// Bodies are never parsed here: they are streamed to the services untouched.
// Also builds the HTTP "upgrade" handler for the WebSocket hub (attached in server.js).
import express from "express";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { httpMetrics } from "./middleware/metrics.js";
import { gauge } from "./config/metrics.js";
import { cors } from "./middleware/cors.js";
import { auth } from "./middleware/auth.js";
import { cache } from "./middleware/cache.js";
import { createCacheRepository } from "./repositories/cache.repository.js";
import { createTokenRepository } from "./repositories/token.repository.js";
import { createCacheService } from "./services/cache.service.js";
import { createTokenService } from "./services/token.service.js";
import { createRealtimeService } from "./services/realtime.service.js";
import { createGatewayController, createUpgradeHandler } from "./controllers/gateway.controller.js";
import { createEventsController } from "./controllers/events.controller.js";
import { createRoutes } from "./routes/index.js";

/** redis may be null (REDIS_URL not set): caching and revocation checks are then off. */
export function createApp({ redis }) {
  const realtimeService = createRealtimeService({ allowedOrigins: config.allowedOrigins, logger });
  // Open pages connected for live updates, read when Prometheus scrapes.
  gauge("woreda_websocket_clients", "Pages connected to the live-update WebSocket.", [], function collect() {
    this.set(realtimeService.count());
  });
  const cacheService = createCacheService({ cacheRepository: createCacheRepository(redis), logger });
  const tokenService = createTokenService({ tokenRepository: createTokenRepository(redis), logger });

  const app = express();
  app.disable("x-powered-by");
  app.disable("etag");
  app.use(requestId);
  app.use(requestLogger(logger));
  app.use(httpMetrics());
  app.use(cors(config.allowedOrigins));
  app.use(auth(config.jwtSecret, tokenService));
  app.use(cache(cacheService));
  app.use(createRoutes(createGatewayController({ services: config.services, logger })));

  const upgradeHandler = createUpgradeHandler({ app, realtimeService, allowedOrigins: config.allowedOrigins, logger });
  const eventsController = createEventsController({ cacheService, realtimeService, logger });
  return { app, upgradeHandler, eventsController, realtimeService, cacheEnabled: cacheService.enabled };
}
