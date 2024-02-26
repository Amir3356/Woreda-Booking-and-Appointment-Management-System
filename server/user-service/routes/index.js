// All HTTP routes of user-service (API.md modules 2 and 8).
import { Router } from "express";
import { createProfileRoutes } from "./profile.routes.js";
import { createStaffRoutes } from "./staff.routes.js";
import { createSettingsRoutes } from "./settings.routes.js";

export function createRoutes({ profileController, staffController, settingsController }) {
  const router = Router();
  router.get("/healthz", (_req, res) => res.status(200).end());
  router.use("/api/v1/citizen/profile", createProfileRoutes(profileController));
  router.use("/api/v1/admin/users", createStaffRoutes(staffController));
  router.use("/api/v1/admin/settings", createSettingsRoutes(settingsController));
  return router;
}
