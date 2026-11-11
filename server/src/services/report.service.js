// Reports: outcome summary for a period and the CSV export of the appointment registry.
import { summaryRange, today } from "../utils/date.js";
import { appointmentsCsv } from "../utils/csv.js";
import { withRates } from "../models/appointment.model.js";
import * as appointments from "../repositories/appointment.repository.js";

export function createReportService({ appointmentService }) {
  return {
    /** GET /reports/summary: outcomes for appointment dates in the period; officers see their own department. */
    async summary(caller, { period, departmentId }) {
      const deptId = caller.role === "OFFICER" ? caller.departmentId : departmentId;
      const { from, to } = summaryRange(period, today());
      const row = await appointments.countOutcomes({ from, to, departmentId: deptId });
      return withRates({
        totalAppointments: row.total,
        completedAppointments: row.completed,
        noShowAppointments: row.no_show,
        cancelledAppointments: row.cancelled,
      });
    },

    /** GET /reports/export-csv: the first 200 matching appointments as CSV. filter: validated registry query. */
    async exportCsv(caller, filter) {
      const { items } = await appointmentService.list(caller, { ...filter, page: 1, limit: 200 });
      return appointmentsCsv(items);
    },
  };
}
