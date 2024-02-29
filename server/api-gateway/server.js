// api-gateway (:8080, behind nginx which does the rate limiting): request id, logging, CORS,
// JWT check + identity headers, Redis response cache, reverse proxy to the services,
// WebSocket live notices (GET /api/v1/ws) fed by Kafka.
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";
import { startMetricsServer } from "./config/metrics.js";
import { connectRedis } from "./config/redis.js";
import { startConsumers } from "./config/kafka.js";
import { createApp } from "./app.js";

const redis = await connectRedis();
const { app, upgradeHandler, eventsController, realtimeService, cacheEnabled } = createApp({ redis });

const stopConsumers = config.kafkaBrokers
  ? startConsumers({ eventsController, cacheEnabled })
  : async () => {};

const server = app.listen(config.port, () => logger.info({ addr: `:${config.port}` }, "listening"));
const metricsServer = startMetricsServer(); // internal /metrics for Prometheus
server.headersTimeout = 5000; // Go: ReadHeaderTimeout 5s
server.requestTimeout = 0; // Go had no overall read timeout (large uploads, slow upstreams)
// Longer than nginx's upstream keepalive (60s), so nginx never reuses a connection we just closed.
server.keepAliveTimeout = 65000;
server.on("upgrade", upgradeHandler);

const shutdownSteps = [
  () => realtimeService.close(),
  () => stopConsumers(),
  () => redis?.quit(),
];

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "shutting down");
  server.close();
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
