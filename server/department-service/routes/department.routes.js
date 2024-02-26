// /api/v1/departments (public list; changes need ADMIN).
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";

export function createDepartmentRoutes(controller) {
  const router = Router();
  const admin = requireRole("ADMIN");
  router.get("/", controller.list);
  router.post("/", admin, controller.create);
  router.put("/:id", admin, controller.update);
  router.patch("/:id/status", admin, controller.toggleStatus);
  router.delete("/:id", admin, controller.remove);
  return router;
}
