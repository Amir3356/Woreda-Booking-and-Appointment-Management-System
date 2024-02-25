// Builds and runs one Express service with the standard middleware order:
//   JSON body -> request log -> JWT caller -> routes -> /healthz -> 404 -> error envelope
import express from "express";
import { authenticate } from "./auth.js";
import { errorHandler, jsonBody, notFoundRoute } from "./http.js";
import { requestLogger } from "./log.js";

export function createApp({ logger, jwtSecret, routes }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  app.use(jsonBody());
  app.use(requestLogger(logger));
  app.use(authenticate(jwtSecret));
  app.get("/healthz", (_req, res) => res.status(200).end());
  routes(app);
  app.use(notFoundRoute);
  app.use(errorHandler(logger));
  return app;
}

/** Listens on port and runs onShutdown callbacks (in order) on SIGINT/SIGTERM. */
export function serve(app, { port, logger, onShutdown = [] }) {
  const server = app.listen(port, () => logger.info({ addr: `:${port}` }, "listening"));
  let stopping = false;
  const stop = async (signal) => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, "shutting down");
    server.close();
    for (const fn of onShutdown) {
      try {
        await fn();
      } catch (err) {
        logger.error({ err: err.message }, "shutdown step failed");
      }
    }
    logger.info("stopped");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  return server;
}
