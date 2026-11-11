// /api/v1/reports (OFFICER or ADMIN).
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { registryQuery, summaryQuery } from "../validations/appointment.validation.js";

export function createReportRoutes(c) {
  const router = Router();
  const staff = requireRole("OFFICER", "ADMIN");
  router.get("/summary", staff, validate({ query: summaryQuery }), c.summary);
  router.get("/export-csv", staff, validate({ query: registryQuery }), c.exportCsv);
  return router;
}
