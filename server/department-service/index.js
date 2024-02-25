// department-service: departments and services (REST :8083), catalog API (gRPC :9083),
// catalog change events (Kafka topic woreda.catalog).
import mongoose from "mongoose";
import { createApp, createLogger, createPublisher, serve } from "./lib/index.js";
import { Department, Service } from "./models.js";
import { Catalog } from "./catalog.js";
import { seedDepartments } from "./seed.js";
import { catalogRoutes } from "./routes.js";
import { startGrpcServer } from "./grpc.js";
import { config } from "./config.js";

const logger = createLogger("department-service");

try {
  await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([Department.init(), Service.init()]); // builds the indexes
  await seedDepartments(logger);
} catch (err) {
  logger.error({ err: err.message }, "connect mongo");
  process.exit(1);
}

const events = createPublisher({
  brokers: config.kafkaBrokers, topic: "woreda.catalog", source: "department-service", keyField: "entityId", logger,
});
const catalog = new Catalog(events);
const app = createApp({ logger, jwtSecret: config.jwtSecret, routes: (a) => a.use(catalogRoutes(catalog)) });

let grpcServer;
try {
  grpcServer = await startGrpcServer({ catalog, protoDir: config.protoDir, port: config.grpcPort, logger });
} catch (err) {
  logger.error({ err: err.message }, "grpc listen");
  process.exit(1);
}

serve(app, {
  port: config.port,
  logger,
  onShutdown: [
    () => new Promise((resolve) => grpcServer.tryShutdown(() => resolve())),
    () => events.close(),
    () => mongoose.disconnect(),
  ],
});
