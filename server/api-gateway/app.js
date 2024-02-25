// The gateway: Express app (request id -> log -> CORS -> auth -> cache -> router) plus the
// HTTP "upgrade" handler for the WebSocket hub, which sits in front of the Express app.
import http from "node:http";
import express from "express";
import { requestLogger } from "./lib/index.js";
import { corsHeaders, cors, requestId } from "./middleware.js";
import { auth } from "./auth.js";
import { cache } from "./cache.js";
import { router } from "./routes.js";
import { cleanPath } from "./paths.js";

export function createGateway({ config, redis, logger }) {
  const app = express();
  app.disable("x-powered-by");
  app.disable("etag");
  // Never parse bodies here: they are streamed to the services untouched.
  app.use(requestId);
  app.use(requestLogger(logger));
  app.use(cors(config.allowedOrigins));
  app.use(auth(config.jwtSecret, redis, logger));
  app.use(cache(redis, logger));
  app.use(router(config.services, logger));
  return app;
}

/** Handles WebSocket upgrades: GET /api/v1/ws goes to the hub, anything else to the Express app. */
export function upgradeHandler({ app, hub, config, logger }) {
  return (req, socket, head) => {
    const path = (req.url || "").split("?")[0];
    if (req.method !== "GET" || cleanPath(path) !== "/api/v1/ws" || path !== "/api/v1/ws") {
      // Answer as a normal HTTP request (401/404/405/301 or a proxied response), then close.
      const res = new http.ServerResponse(req);
      res.shouldKeepAlive = false;
      res.assignSocket(socket);
      res.on("finish", () => {
        res.detachSocket(socket);
        socket.destroySoon();
      });
      return app(req, res);
    }
    const start = process.hrtime.bigint();
    let id = req.headers["x-request-id"];
    if (!id) {
      requestId(req, { setHeader() {} }, () => {});
      id = req.headers["x-request-id"];
    }
    const status = hub.handleUpgrade(req, socket, head, { "X-Request-ID": id, ...corsHeaders(config.allowedOrigins, req.headers.origin) });
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info({ method: req.method, path, status, duration: `${ms.toFixed(2)}ms`, requestId: id }, "request");
  };
}
