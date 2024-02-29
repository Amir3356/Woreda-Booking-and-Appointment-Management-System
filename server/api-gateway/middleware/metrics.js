// Records every HTTP request in the Prometheus metrics (config/metrics.js). The route label is the
// path with ids replaced by ":id", so each appointment or service does not become its own series.
import { httpDuration, httpRequests } from "../config/metrics.js";

/** "/api/v1/appointments/apt-1a2b3c4d5e6f/status" -> "/api/v1/appointments/:id/status". */
export function routeLabel(path) {
  return (
    path
      .split("?")[0]
      .split("/")
      .map((seg) => (/\d/.test(seg) && seg.length >= 4 ? ":id" : seg))
      .join("/") || "/"
  );
}

export function httpMetrics() {
  return (req, res, next) => {
    const end = httpDuration.startTimer();
    const route = routeLabel(req.originalUrl || req.url);
    res.on("finish", () => {
      const labels = { method: req.method, route };
      end(labels);
      httpRequests.inc({ ...labels, status: String(res.statusCode) });
    });
    next();
  };
}
