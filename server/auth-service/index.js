// auth-service: registration, sign-in, profile and logout (REST :8081). Redis (optional) holds
// revoked token IDs (checked by the api-gateway) and failed-login counters.
import mongoose from "mongoose";
import { createApp, createLogger, serve } from "./lib/index.js";
import { User } from "./models.js";
import { AuthService } from "./auth.js";
import { authRoutes } from "./routes.js";
import { connectSessionStore } from "./sessions.js";
import { config } from "./config.js";

const logger = createLogger("auth-service");

try {
  await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 10000 });
  await User.init(); // builds the users indexes (same definitions as user-service)
} catch (err) {
  logger.error({ err: err.message }, "connect mongo");
  process.exit(1);
}

let redis = null;
if (!config.redisUrl) {
  logger.warn("REDIS_URL not set: logout does not revoke tokens and login lockout is off");
} else {
  redis = await connectSessionStore(config.redisUrl, logger);
}

const auth = new AuthService({ sessions: redis?.store ?? null, jwtSecret: config.jwtSecret, logger });
const app = createApp({ logger, jwtSecret: config.jwtSecret, routes: (a) => a.use(authRoutes(auth)) });

serve(app, {
  port: config.port,
  logger,
  onShutdown: [...(redis ? [() => redis.close()] : []), () => mongoose.disconnect()],
});
