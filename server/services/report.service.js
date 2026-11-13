// Reports: outcome summary for a period and the CSV export of the appointment registry.
import { summaryRange, today } from "../utils/date.js";
import { appointmentsCsv } from "../utils/csv.js";
import { withRates } from "../models/appointment.model.js";
import * as appointments from "../repositories/appointment.repository.js";
import { rows } from "../config/database.js";

function parseAddress(addr) {
  if (!addr) return { kebele: "Kebele 01", woreda: "Woreda 01", location: "Central Sub-City" };
  const parts = String(addr).split(",").map((s) => s.trim()).filter(Boolean);
  let kebele = "";
  let woreda = "";
  let location = "";

  for (const p of parts) {
    const low = p.toLowerCase();
    if (!kebele && (low.startsWith("kebele") || low.startsWith("keb"))) {
      kebele = p;
    } else if (!woreda && (low.startsWith("woreda") || low.startsWith("wor"))) {
      woreda = p;
    } else if (!location && !low.startsWith("house") && !/^\d+$/.test(p)) {
      location = p;
    }
  }

  if (!kebele && parts[0]) {
    const p0 = parts[0];
    kebele = /^\d+$/.test(p0) ? `Kebele ${p0.padStart(2, "0")}` : (p0.toLowerCase().startsWith("kebele") ? p0 : `Kebele ${p0}`);
  }
  if (!woreda && parts[1]) {
    const p1 = parts[1];
    woreda = /^\d+$/.test(p1) ? `Woreda ${p1.padStart(2, "0")}` : (p1.toLowerCase().startsWith("woreda") ? p1 : `Woreda ${p1}`);
  }
  if (!location && parts[2]) {
    location = parts[2];
  } else if (!location && parts[0] && !/^\d+$/.test(parts[0]) && !parts[0].toLowerCase().startsWith("kebele") && !parts[0].toLowerCase().startsWith("woreda")) {
    location = parts[0];
  }

  return {
    kebele: kebele || "Kebele 01",
    woreda: woreda || "Woreda 01",
    location: location || "Central Sub-City",
  };
}

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

    /** GET /reports/geographical: real-time geographical analytics aggregated across citizens and appointments. */
    async geographical(caller) {
      const citizens = await rows(
        "SELECT id, full_name, phone, address, is_active, created_at FROM users WHERE role = 'CITIZEN'"
      );
      const allAppointments = await rows(
        `SELECT a.id, a.reference_number, a.citizen_id, a.citizen_name, a.citizen_phone,
                a.department_id, a.service_id, a.date, a.time_slot, a.status,
                u.address
         FROM appointments a
         LEFT JOIN users u ON u.id = a.citizen_id`
      );

      const palette = ["#0b2545", "#1d4ed8", "#059669", "#d97706", "#7c3aed", "#64748b", "#ec4899", "#06b6d4"];

      const locationMap = {};
      const woredaMap = {};
      const kebeleMap = {};

      citizens.forEach((c) => {
        const geo = parseAddress(c.address);
        if (!locationMap[geo.location]) locationMap[geo.location] = { name: geo.location, users: 0, bookings: 0, completed: 0 };
        locationMap[geo.location].users++;

        if (!woredaMap[geo.woreda]) woredaMap[geo.woreda] = { name: geo.woreda, location: geo.location, users: 0, bookings: 0 };
        woredaMap[geo.woreda].users++;

        if (!kebeleMap[geo.kebele]) kebeleMap[geo.kebele] = { name: geo.kebele, woreda: geo.woreda, location: geo.location, users: 0, bookings: 0 };
        kebeleMap[geo.kebele].users++;
      });

      let completedCount = 0;
      let pendingCount = 0;
      let cancelledCount = 0;

      allAppointments.forEach((a) => {
        const geo = parseAddress(a.address);
        if (!locationMap[geo.location]) locationMap[geo.location] = { name: geo.location, users: 0, bookings: 0, completed: 0 };
        locationMap[geo.location].bookings++;

        if (!woredaMap[geo.woreda]) woredaMap[geo.woreda] = { name: geo.woreda, location: geo.location, users: 0, bookings: 0 };
        woredaMap[geo.woreda].bookings++;

        if (!kebeleMap[geo.kebele]) kebeleMap[geo.kebele] = { name: geo.kebele, woreda: geo.woreda, location: geo.location, users: 0, bookings: 0 };
        kebeleMap[geo.kebele].bookings++;

        if (a.status === "COMPLETED") {
          completedCount++;
          locationMap[geo.location].completed++;
        } else if (["CANCELLED", "REJECTED", "NO_SHOW"].includes(a.status)) {
          cancelledCount++;
        } else {
          pendingCount++;
        }
      });

      const sortedLocations = Object.values(locationMap).sort((a, b) => b.bookings - a.bookings || b.users - a.users);
      const sortedWoredas = Object.values(woredaMap).sort((a, b) => b.bookings - a.bookings || b.users - a.users);
      const sortedKebeles = Object.values(kebeleMap).sort((a, b) => b.bookings - a.bookings || b.users - a.users);

      const totalBookings = allAppointments.length;
      const topLoc = sortedLocations[0] || { name: "Central Sub-City", users: citizens.length, bookings: totalBookings };
      const topWoreda = sortedWoredas[0] || { name: "Woreda 01", location: topLoc.name, users: citizens.length, bookings: totalBookings };
      const lowWoreda = sortedWoredas[sortedWoredas.length - 1] || topWoreda;
      const topKebele = sortedKebeles[0] || { name: "Kebele 01", woreda: topWoreda.name, users: citizens.length, bookings: totalBookings };
      const lowKebele = sortedKebeles[sortedKebeles.length - 1] || topKebele;

      return {
        geographicalSummary: {
          totalRegisteredUsers: citizens.length,
          totalBookings,
          activeLocationsCount: sortedLocations.length || (citizens.length > 0 ? 1 : 0),
          activeWoredasCount: sortedWoredas.length || (citizens.length > 0 ? 1 : 0),
          activeKebelesCount: sortedKebeles.length || (citizens.length > 0 ? 1 : 0),
          mostActiveLocation: {
            name: topLoc.name,
            users: topLoc.users,
            bookings: topLoc.bookings,
            share: totalBookings > 0 ? `${((topLoc.bookings / totalBookings) * 100).toFixed(1)}%` : "0%",
          },
          woredaExtremes: {
            highest: {
              name: topWoreda.name,
              location: topWoreda.location,
              users: topWoreda.users,
              bookings: topWoreda.bookings,
            },
            lowest: {
              name: lowWoreda.name,
              location: lowWoreda.location,
              users: lowWoreda.users,
              bookings: lowWoreda.bookings,
            },
          },
          kebeleExtremes: {
            highest: {
              name: topKebele.name,
              woreda: topKebele.woreda,
              users: topKebele.users,
              bookings: topKebele.bookings,
            },
            lowest: {
              name: lowKebele.name,
              woreda: lowKebele.woreda,
              users: lowKebele.users,
              bookings: lowKebele.bookings,
            },
          },
          mostActiveArea: {
            title: `${topLoc.name} · ${topWoreda.name} · ${topKebele.name}`,
            badge: "Highest System Traffic",
            summary: "Leading across registered citizens, appointment slots, and online service completions.",
            users: topLoc.users,
            bookings: topLoc.bookings,
          },
        },
        locationUsageData: sortedLocations.map((l) => ({
          location: l.name,
          users: l.users,
          bookings: l.bookings,
          fulfillmentRate: l.bookings > 0 ? Math.round((l.completed / l.bookings) * 100) : 0,
        })),
        locationShareData: sortedLocations.map((l, i) => ({
          name: l.name,
          value: l.bookings,
          color: palette[i % palette.length],
        })),
        woredaUsageData: sortedWoredas.map((w, i) => ({
          woreda: w.name,
          users: w.users,
          bookings: w.bookings,
          rank: i === 0 ? "Highest" : i === sortedWoredas.length - 1 ? "Lowest" : "Moderate",
        })),
        kebeleUsageData: sortedKebeles.map((k, i) => ({
          kebele: k.name,
          users: k.users,
          bookings: k.bookings,
          status: i === 0 ? "Highest Active" : i === sortedKebeles.length - 1 ? "Lowest Active" : "Moderate Active",
        })),
        fulfillmentStatusData: [
          { name: "Completed Desk Visits", value: completedCount, color: "#10b981" },
          { name: "Pending / Upcoming", value: pendingCount, color: "#3b82f6" },
          { name: "Cancelled / No-Show", value: cancelledCount, color: "#f43f5e" },
        ],
      };
    },

    /** GET /reports/export-csv: the first 200 matching appointments as CSV. filter: validated registry query. */
    async exportCsv(caller, filter) {
      const { items } = await appointmentService.list(caller, { ...filter, page: 1, limit: 200 });
      return appointmentsCsv(items);
    },
  };
}
