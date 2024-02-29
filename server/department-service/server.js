// department-service: departments and the public service catalog (REST :8083),
// catalog API for other services (gRPC :9083), catalog change events (Kafka topic woreda.catalog).
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { startMetricsServer } from "./config/metrics.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { createEventPublisher } from "./config/kafka.js";
import { startGrpcServer } from "./config/grpc.js";
import { seedDepartments } from "./config/seed.js";
import { createApp } from "./app.js";

try {
  await connectDatabase();
  await seedDepartments();
} catch (err) {
  logger.error({ err: err.message }, "connect mongo");
  process.exit(1);
}

const events = createEventPublisher();
const { app, grpcController } = createApp({ events });

let grpcServer;
try {
  grpcServer = await startGrpcServer(grpcController);
} catch (err) {
  logger.error({ err: err.message }, "grpc listen");
  process.exit(1);
}

const httpServer = app.listen(config.port, () => logger.info({ addr: `:${config.port}` }, "listening"));
const metricsServer = startMetricsServer(); // internal /metrics for Prometheus

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "shutting down");
  httpServer.close();
  metricsServer.close();
  await new Promise((resolve) => grpcServer.tryShutdown(() => resolve()));
  await events.close();
  await disconnectDatabase();
  logger.info("stopped");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
