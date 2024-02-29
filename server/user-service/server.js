// user-service: citizen profiles, staff provisioning and system settings (REST :8082).
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { startMetricsServer } from "./config/metrics.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { seedDefaults } from "./config/seed.js";
import { createApp } from "./app.js";

try {
  await connectDatabase();
  await seedDefaults();
} catch (err) {
  logger.error({ err: err.message }, "connect mongo");
  process.exit(1);
}

const app = createApp();
const httpServer = app.listen(config.port, () => logger.info({ addr: `:${config.port}` }, "listening"));
const metricsServer = startMetricsServer(); // internal /metrics for Prometheus

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "shutting down");
  httpServer.close();
  metricsServer.close();
  try {
    await disconnectDatabase();
  } catch (err) {
    logger.error({ err: err.message }, "shutdown step failed");
  }
  logger.info("stopped");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
