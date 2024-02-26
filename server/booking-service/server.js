// booking-service: operating schedules, slot availability and the desk queue (REST :8085),
// appointment lifecycle events from the desk (Kafka topic woreda.appointments).
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { createEventPublisher } from "./config/kafka.js";
import { createApp } from "./app.js";

try {
  await connectDatabase();
} catch (err) {
  logger.error({ err: err.message }, "connect mongo");
  process.exit(1);
}

const events = createEventPublisher();
const app = createApp({ events });

const httpServer = app.listen(config.port, () => logger.info({ addr: `:${config.port}` }, "listening"));

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "shutting down");
  httpServer.close();
  for (const step of [() => events.close(), () => disconnectDatabase()]) {
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
