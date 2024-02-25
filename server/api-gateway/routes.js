// Gateway endpoints -> upstream services (same table as the Go gateway's routes.go).
import { createProxyMiddleware } from "http-proxy-middleware";
import { cleanPath, underPrefix } from "./paths.js";
import { writeError, writeText } from "./middleware.js";

const ROUTES = [
  // Authentication -> auth-service
  ["/api/v1/auth", "auth"],
  // Citizen profile, staff provisioning, and system settings -> user-service
  ["/api/v1/citizen", "user"],
  ["/api/v1/admin/users", "user"],
  ["/api/v1/admin/settings", "user"],
  // Departments and service catalog -> department-service
  ["/api/v1/departments", "department"],
  ["/api/v1/services", "department"],
  // Appointment lifecycle and reports -> appointment-service
  ["/api/v1/appointments", "appointment"],
  ["/api/v1/reports", "appointment"],
  // Operating schedules and live counter queue -> booking-service
  ["/api/v1/schedules", "booking"],
  ["/api/v1/queue", "booking"],
];

const HEALTH_BODY = '{"success":true,"service":"api-gateway","status":"healthy"}';

const clientIp = (req) => (req.socket.remoteAddress || "").replace(/^::ffff:/, "");

/** A reverse proxy that forwards requests unchanged (full /api/v1 path, untouched body) to target. */
export function upstreamProxy(target, logger) {
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
      error(err, req, res) {
        logger.error({ upstream: target, path: req.path ?? req.url, err: err.message }, "upstream error");
        if (typeof res.setHeader !== "function") return res.destroy?.(); // a raw socket
        if (res.headersSent) return res.destroy();
        writeError(req, res, 502, "BAD_GATEWAY", "Upstream service unavailable.");
      },
    },
  });
}

/** The innermost handler: /healthz, proxying, and Go ServeMux's 301 / 404 / 405 answers. */
export function router(services, logger) {
  const proxies = Object.fromEntries(Object.entries(services).map(([name, url]) => [name, upstreamProxy(url, logger)]));
  return (req, res, next) => {
    const raw = req.path;
    const clean = cleanPath(raw);
    if (clean !== raw && req.method !== "CONNECT") {
      const qi = req.url.indexOf("?");
      res.statusCode = 301;
      res.setHeader("Location", clean + (qi < 0 ? "" : req.url.slice(qi)));
      return res.end();
    }
    if (raw === "/healthz" || raw === "/api/v1/ws") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        return writeText(res, 405, "Method Not Allowed", { Allow: "GET, HEAD" });
      }
      if (raw === "/api/v1/ws") {
        // Reached only without an Upgrade header (upgrades are handled on the HTTP server).
        return writeText(res, 426, 'WebSocket protocol violation: Connection header "" does not contain Upgrade',
          { Connection: "Upgrade", Upgrade: "websocket" });
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(req.method === "HEAD" ? undefined : HEALTH_BODY);
    }
    const route = ROUTES.find(([prefix]) => underPrefix(raw, prefix));
    if (!route) return writeText(res, 404, "404 page not found");
    return proxies[route[1]](req, res, next);
  };
}
