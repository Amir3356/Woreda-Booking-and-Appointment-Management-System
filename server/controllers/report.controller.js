// /api/v1/reports.
import { ok } from "../utils/response.js";

export function createReportController(reportService) {
  return {
    async summary(req, res) {
      ok(res, 200, "Summary retrieved successfully.", await reportService.summary(req.caller, req.validatedQuery));
    },
    async geographical(req, res) {
      ok(res, 200, "Geographical analytics retrieved successfully.", await reportService.geographical(req.caller));
    },
    async exportCsv(req, res) {
      const csv = await reportService.exportCsv(req.caller, req.validatedQuery);
      res.status(200)
        .set("Content-Type", "text/csv; charset=utf-8")
        .set("Content-Disposition", 'attachment; filename="woreda_appointment_report.csv"')
        .send(csv);
    },
  };
}
