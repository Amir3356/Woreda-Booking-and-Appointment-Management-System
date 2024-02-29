// Prometheus metrics (Admin monitoring: Prometheus + Grafana in server/monitoring/).
// One registry per process with the label service="api-gateway". The /metrics page is served by a
// small separate HTTP server on METRICS_PORT (default 9464): it is reachable only on the internal
// Docker network (Prometheus), never through nginx or the gateway.
import http from "node:http";
import client from "prom-client";
import { logger } from "./logger.js";

export const SERVICE_NAME = "api-gateway";
export const registry = new client.Registry();
registry.setDefaultLabels({ service: SERVICE_NAME });
client.collectDefaultMetrics({ register: registry }); // CPU, memory, event-loop lag, GC, handles

/** HTTP requests by method, route template (ids replaced by :id) and status code. */
export const httpRequests = new client.Counter({
  name: "http_requests_total",
  help: "HTTP requests handled, by method, route and status code.",
  labelNames: ["method", "route", "status"],
  registers: [registry],
});

/** Response time in seconds, by method and route template. */
export const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP response time in seconds, by method and route.",
  labelNames: ["method", "route"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

/** A counter in this service's registry (business events). */
export const counter = (name, help, labelNames = []) =>
  new client.Counter({ name, help, labelNames, registers: [registry] });

/** A gauge in this service's registry; collect (optional) sets its value at scrape time. */
export const gauge = (name, help, labelNames = [], collect = undefined) =>
  new client.Gauge({ name, help, labelNames, registers: [registry], ...(collect ? { collect } : {}) });

/** A histogram in this service's registry. */
export const histogram = (name, help, labelNames = [], buckets = undefined) =>
  new client.Histogram({ name, help, labelNames, buckets, registers: [registry] });

/** Starts the internal /metrics server; returns it (close it on shutdown). */
export function startMetricsServer(port = Number(process.env.METRICS_PORT) || 9464) {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url.split("?")[0] === "/metrics") {
      try {
        res.writeHead(200, { "Content-Type": registry.contentType });
        res.end(await registry.metrics());
      } catch (err) {
        res.writeHead(500).end(String(err?.message ?? err));
      }
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(port, () => logger.info({ addr: `:${port}` }, "metrics listening"));
  return server;
}
