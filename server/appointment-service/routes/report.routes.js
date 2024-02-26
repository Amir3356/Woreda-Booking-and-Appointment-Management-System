// /api/v1/reports (API.md reports module; OFFICER or ADMIN).
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";

export function createReportRoutes(controller) {
  const router = Router();
  const staff = requireRole("OFFICER", "ADMIN");
  router.get("/summary", staff, controller.summary);
  router.get("/export-csv", staff, controller.exportCsv);
  return router;
}
