// api-gateway (:8080, behind nginx which does the rate limiting): request id, logging, CORS,
// JWT check + identity headers, Redis response cache, reverse proxy to the services,
// WebSocket live notices (GET /api/v1/ws) fed by Kafka.
import { createLogger, serve } from "./lib/index.js";
import { config } from "./config.js";
import { connectRedis } from "./redis.js";
import { Hub } from "./hub.js";
import { createGateway, upgradeHandler } from "./app.js";
import { startConsumers } from "./consumers.js";

const logger = createLogger("api-gateway");
const redis = await connectRedis(config.redisUrl, logger);
const hub = new Hub(config.allowedOrigins, logger);
const app = createGateway({ config, redis, logger });

const stopConsumers = config.kafkaBrokers
  ? startConsumers({ brokers: config.kafkaBrokers, redis, hub, logger })
  : async () => {};

const server = serve(app, {
  port: config.port,
  logger,
  onShutdown: [
    () => hub.close(),
    () => stopConsumers(),
    () => redis?.quit(),
  ],
});
server.headersTimeout = 5000; // Go: ReadHeaderTimeout 5s
server.requestTimeout = 0; // Go had no overall read timeout (large uploads, slow upstreams)
// Longer than nginx's upstream keepalive (60s), so nginx never reuses a connection we just closed.
server.keepAliveTimeout = 65000;
server.on("upgrade", upgradeHandler({ app, hub, config, logger }));
