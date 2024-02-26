// /api/v1/admin/users (ADMIN only).
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";

export function createStaffRoutes(controller) {
  const router = Router();
  const admin = requireRole("ADMIN");
  router.get("/", admin, controller.list);
  router.post("/provision", admin, controller.provision);
  router.patch("/:id/status", admin, controller.toggleStatus);
  router.delete("/:id", admin, controller.remove);
  return router;
}
