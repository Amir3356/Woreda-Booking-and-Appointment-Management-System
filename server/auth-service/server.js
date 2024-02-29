// auth-service: registration, sign-in, profile and logout (REST :8081). Redis (optional) holds
// revoked token IDs (checked by the api-gateway) and failed-login counters.
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { startMetricsServer } from "./config/metrics.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { connectRedis } from "./config/redis.js";
import { createApp } from "./app.js";

try {
  await connectDatabase();
} catch (err) {
  logger.error({ err: err.message }, "connect mongo");
  process.exit(1);
}

let redis = null;
if (!config.redisUrl) {
  logger.warn("REDIS_URL not set: logout does not revoke tokens and login lockout is off");
} else {
  redis = await connectRedis(config.redisUrl);
}

const app = createApp({ redis: redis?.redis ?? null });
const httpServer = app.listen(config.port, () => logger.info({ addr: `:${config.port}` }, "listening"));
const metricsServer = startMetricsServer(); // internal /metrics for Prometheus

// Runs each step in order; a failing step is logged and the rest still run.
const shutdownSteps = [...(redis ? [() => redis.close()] : []), () => disconnectDatabase()];

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "shutting down");
  httpServer.close();
  metricsServer.close();
  for (const step of shutdownSteps) {
    try {
      await step();
    } catch (err) {
      logger.error({ err: err.message }, "shutdown step failed");
    }
  }
  logger.info("stopped");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
