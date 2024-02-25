// booking-service: operating schedules, slot availability and the desk queue (REST :8085),
// appointment lifecycle events from the desk (Kafka topic woreda.appointments).
import mongoose from "mongoose";
import { createApp, createLogger, createPublisher, serve } from "./lib/index.js";
import { QueueToken, Schedule } from "./models.js";
import { Schedules } from "./schedules.js";
import { Queue } from "./queue.js";
import { bookingRoutes } from "./routes.js";
import { config } from "./config.js";

const logger = createLogger("booking-service");

try {
  await mongoose.connect(config.mongoUrl, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([Schedule.init(), QueueToken.init()]); // builds the indexes
} catch (err) {
  logger.error({ err: err.message }, "connect mongo");
  process.exit(1);
}

const events = createPublisher({
  brokers: config.kafkaBrokers, topic: "woreda.appointments", source: "booking-service", keyField: "appointmentId", logger,
});
const app = createApp({
  logger, jwtSecret: config.jwtSecret, routes: (a) => a.use(bookingRoutes(new Schedules(), new Queue(events))),
});

serve(app, {
  port: config.port,
  logger,
  onShutdown: [() => events.close(), () => mongoose.disconnect()],
});
