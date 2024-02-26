// Reports: outcome summary for a period and the CSV export of the appointment registry.
import { today, summaryRange } from "../utils/date.js";
import { withRates } from "../utils/appointment.js";
import { appointmentsCsv } from "../utils/csv.js";
import * as appointments from "../repositories/appointment.repository.js";

export function createReportService({ appointmentService }) {
  return {
    /** GET /reports/summary: outcomes for appointment dates in the period; officers see their own department. */
    async summary(caller, period, departmentId) {
      const deptId = caller.role === "OFFICER" ? caller.departmentId : departmentId;
      const { from, to } = summaryRange(period, today());
      const row = await appointments.countOutcomes({ from, to, departmentId: deptId });
      return withRates({
        totalAppointments: row?.total ?? 0,
        completedAppointments: row?.completed ?? 0,
        noShowAppointments: row?.noShow ?? 0,
        cancelledAppointments: row?.cancelled ?? 0,
      });
    },

    /** GET /reports/export-csv: the first 200 matching appointments as CSV.
     *  TODO (as in Go): stream with a cursor instead of loading a capped page. */
    async exportCsv(caller, filter) {
      const { items } = await appointmentService.list(caller, { ...filter, page: 1, limit: 200 });
      return appointmentsCsv(items);
    },
  };
}
