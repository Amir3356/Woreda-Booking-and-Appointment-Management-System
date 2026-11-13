// /api/v1/reports (OFFICER or ADMIN).
import { Router } from "express";
import { checkAbility } from "../middleware/casl.js";
import { Actions, Subjects } from "../security/abilities.js";
import { validate } from "../middleware/validate.js";
import { registryQuery, summaryQuery } from "../validations/appointment.validation.js";

export function createReportRoutes(c) {
  const router = Router();
  const canReadReport = checkAbility(Actions.READ, Subjects.REPORT);
  const canExportReport = checkAbility(Actions.EXPORT, Subjects.REPORT);
  router.get("/summary", canReadReport, validate({ query: summaryQuery }), c.summary);
  router.get("/geographical", canReadReport, c.geographical);
  router.get("/export-csv", canExportReport, validate({ query: registryQuery }), c.exportCsv);
  return router;
}
