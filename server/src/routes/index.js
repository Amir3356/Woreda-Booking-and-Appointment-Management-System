// Every HTTP route of the API, mounted under /api/v1 (plus /healthz).
import { Router } from "express";
import { createAuthRoutes } from "./auth.routes.js";
import { createProfileRoutes } from "./profile.routes.js";
import { createStaffRoutes } from "./staff.routes.js";
import { createSettingsRoutes } from "./settings.routes.js";
import { createDepartmentRoutes } from "./department.routes.js";
import { createPublicServiceRoutes } from "./publicService.routes.js";
import { createScheduleRoutes } from "./schedule.routes.js";
import { createAppointmentRoutes } from "./appointment.routes.js";
import { createQueueRoutes } from "./queue.routes.js";
import { createReportRoutes } from "./report.routes.js";
import { createAuditRoutes } from "./audit.routes.js";

export function createRoutes(c) {
  const api = Router();
  api.use("/auth", createAuthRoutes(c.auth));
  api.use("/citizen/profile", createProfileRoutes(c.profile));
  api.use("/admin/users", createStaffRoutes(c.staff));
  api.use("/admin/settings", createSettingsRoutes(c.settings));
  api.use("/departments", createDepartmentRoutes(c.department));
  api.use("/services", createPublicServiceRoutes(c.publicService));
  api.use("/schedules", createScheduleRoutes(c.schedule));
  api.use("/appointments", createAppointmentRoutes(c.appointment));
  api.use("/queue", createQueueRoutes(c.queue));
  api.use("/reports", createReportRoutes(c.report));
  api.use("/audit-logs", createAuditRoutes(c.audit));

  const router = Router();
  router.get("/healthz", c.health.check);
  router.use("/api/v1", api);
  return router;
}
