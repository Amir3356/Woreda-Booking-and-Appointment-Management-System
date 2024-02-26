// HTTP handlers of the gateway itself: /healthz, forwarding to the upstream services, and the
// HTTP "upgrade" handler that hands GET /api/v1/ws to the WebSocket hub.
import http from "node:http";
import { createProxyMiddleware } from "http-proxy-middleware";
import { cleanPath } from "../utils/paths.js";
import { writeText } from "../utils/response.js";
import { upstreamError } from "../middleware/errorHandler.js";
import { requestId } from "../middleware/requestId.js";
import { corsHeaders } from "../middleware/cors.js";

const HEALTH_BODY = '{"success":true,"service":"api-gateway","status":"healthy"}';

const clientIp = (req) => (req.socket.remoteAddress || "").replace(/^::ffff:/, "");

/** A reverse proxy that forwards requests unchanged (full /api/v1 path, untouched body) to target. */
function upstreamProxy(target, logger) {
  return createProxyMiddleware({
    target,
    changeOrigin: true, // Host = upstream host, as Go's SetURL
    on: {
      proxyReq(proxyReq, req) {
        // Go's SetXForwarded: the client-supplied values are replaced, not appended to.
        proxyReq.setHeader("X-Forwarded-For", clientIp(req));
        proxyReq.setHeader("X-Forwarded-Host", req.headers.host || "");
        proxyReq.setHeader("X-Forwarded-Proto", req.socket.encrypted ? "https" : "http");
      },
      error: upstreamError(target, logger),
    },
  });
}

/** services: {name -> upstream base URL}. */
export function createGatewayController({ services, logger }) {
  const proxies = Object.fromEntries(Object.entries(services).map(([name, url]) => [name, upstreamProxy(url, logger)]));
  return {
    /** GET/HEAD /healthz. */
    health(req, res) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(req.method === "HEAD" ? undefined : HEALTH_BODY);
    },

    /** GET /api/v1/ws without an Upgrade header (upgrades are handled on the HTTP server). */
    websocketRequired(_req, res) {
      return writeText(res, 426, 'WebSocket protocol violation: Connection header "" does not contain Upgrade',
        { Connection: "Upgrade", Upgrade: "websocket" });
    },

    /** Streams the request to the named upstream service and its response back. */
    forward(service, req, res, next) {
      return proxies[service](req, res, next);
    },
  };
}

/** Handles WebSocket upgrades: GET /api/v1/ws goes to the hub, anything else to the Express app. */
export function createUpgradeHandler({ app, realtimeService, allowedOrigins, logger }) {
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
    const status = realtimeService.handleUpgrade(req, socket, head, { "X-Request-ID": id, ...corsHeaders(allowedOrigins, req.headers.origin) });
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info({ method: req.method, path, status, duration: `${ms.toFixed(2)}ms`, requestId: id }, "request");
  };
}
