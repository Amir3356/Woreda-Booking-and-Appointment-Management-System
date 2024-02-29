// appointment-service: booking, tracking, review and reports (REST :8084), catalog lookups over
// gRPC (department-service), appointment lifecycle events (Kafka topic woreda.appointments).
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { startMetricsServer } from "./config/metrics.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { createEventPublisher } from "./config/kafka.js";
import { createCatalogClient } from "./config/grpc.js";
import { createApp } from "./app.js";

try {
  await connectDatabase();
} catch (err) {
  logger.error({ err: err.message }, "connect mongo");
  process.exit(1);
}

const events = createEventPublisher();

let catalogClient;
try {
  catalogClient = createCatalogClient();
} catch (err) {
  logger.error({ err: err.message }, "catalog client");
  process.exit(1);
}
logger.info({ addr: config.catalogGrpcAddr }, "catalog lookups via gRPC");

const app = createApp({ events, catalogClient });
const httpServer = app.listen(config.port, () => logger.info({ addr: `:${config.port}` }, "listening"));
const metricsServer = startMetricsServer(); // internal /metrics for Prometheus

// Shutdown steps run in order; a failing step is logged and the next one still runs.
const shutdownSteps = [() => events.close(), () => catalogClient.close(), () => disconnectDatabase()];

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
