// Gateway endpoints -> upstream services (same table as the Go gateway's routes.go), dispatched
// like Go's http.ServeMux: 301 to the cleaned path, /healthz, 405, 404, or proxied.
import { cleanPath, underPrefix } from "../utils/paths.js";
import { writeText } from "../utils/response.js";
import { notFound } from "../middleware/errorHandler.js";

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

/** The innermost handler: /healthz, proxying, and Go ServeMux's 301 / 404 / 405 answers. */
export function createRoutes(gatewayController) {
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
      if (raw === "/api/v1/ws") return gatewayController.websocketRequired(req, res);
      return gatewayController.health(req, res);
    }
    const route = ROUTES.find(([prefix]) => underPrefix(raw, prefix));
    if (!route) return notFound(req, res);
    return gatewayController.forward(route[1], req, res, next);
  };
}
