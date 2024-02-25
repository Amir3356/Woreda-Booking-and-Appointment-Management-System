// appointment-service: booking, tracking, review and reports (REST :8084), catalog lookups over
// gRPC (department-service), appointment lifecycle events (Kafka topic woreda.appointments).
import mongoose from "mongoose";
import { createApp, createLogger, createPublisher, serve } from "./lib/index.js";
import { Appointment, SlotReservation } from "./models.js";
import { Appointments } from "./appointments.js";
import { createCatalogClient } from "./catalog.js";
import { appointmentRoutes } from "./routes.js";
import { config } from "./config.js";

const logger = createLogger("appointment-service");

try {
  await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([Appointment.init(), SlotReservation.init()]); // builds the indexes
} catch (err) {
  logger.error({ err: err.message }, "connect mongo");
  process.exit(1);
}

const events = createPublisher({
  brokers: config.kafkaBrokers, topic: "woreda.appointments", source: "appointment-service", keyField: "appointmentId", logger,
});

let catalog;
try {
  catalog = createCatalogClient({ addr: config.catalogGrpcAddr, protoDir: config.protoDir });
} catch (err) {
  logger.error({ err: err.message }, "catalog client");
  process.exit(1);
}
logger.info({ addr: config.catalogGrpcAddr }, "catalog lookups via gRPC");

const appointments = new Appointments({ catalog, events });
const app = createApp({ logger, jwtSecret: config.jwtSecret, routes: (a) => a.use(appointmentRoutes(appointments)) });

serve(app, {
  port: config.port,
  logger,
  onShutdown: [() => events.close(), () => catalog.close(), () => mongoose.disconnect()],
});
