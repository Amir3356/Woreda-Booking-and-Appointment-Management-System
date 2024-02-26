// HTTP handlers for /api/v1/reports: read the request, call the service, send the envelope or CSV.
import { ok, query } from "../utils/response.js";
import { listFilter } from "./appointment.controller.js";

export function createReportController(reportService) {
  return {
    async summary(req, res) {
      ok(res, 200, "Summary retrieved successfully.", await reportService.summary(req.caller, query(req, "period"), query(req, "departmentId")));
    },
    async exportCsv(req, res) {
      const csv = await reportService.exportCsv(req.caller, listFilter(req));
      res.status(200)
        .set("Content-Type", "text/csv; charset=utf-8")
        .set("Content-Disposition", 'attachment; filename="woreda_appointment_report.csv"')
        .send(csv);
    },
  };
}
