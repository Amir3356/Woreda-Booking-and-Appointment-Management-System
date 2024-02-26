// All HTTP routes of department-service.
import { Router } from "express";
import { createDepartmentRoutes } from "./department.routes.js";
import { createPublicServiceRoutes } from "./publicService.routes.js";

export function createRoutes({ departmentController, publicServiceController }) {
  const router = Router();
  router.get("/healthz", (_req, res) => res.status(200).end());
  router.use("/api/v1/departments", createDepartmentRoutes(departmentController));
  router.use("/api/v1/services", createPublicServiceRoutes(publicServiceController));
  return router;
}
