// /api/v1/admin/settings (ADMIN only).
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";

export function createSettingsRoutes(controller) {
  const router = Router();
  const admin = requireRole("ADMIN");
  router.get("/", admin, controller.get);
  router.put("/", admin, controller.update);
  return router;
}
