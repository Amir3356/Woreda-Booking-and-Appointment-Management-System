// /api/v1/appointments and /api/v1/reports (API.md appointment + reports modules).
import { Router, body, ok, requireRole, timestamp } from "./lib/index.js";
import { appointmentsCsv, atoi, normalizePage, pagination } from "./rules.js";

/** First value of a query parameter ("" when absent), like Go's url.Values.Get. */
const q = (req, key) => {
  const v = req.query[key];
  return Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
};

function listFilter(req) {
  return {
    timeframe: q(req, "timeframe"), status: q(req, "status"), departmentId: q(req, "departmentId"),
    search: q(req, "search"), page: atoi(q(req, "page")), limit: atoi(q(req, "limit")),
  };
}

export function appointmentRoutes(appointments) {
  const r = Router();
  const signedIn = requireRole("CITIZEN", "OFFICER", "ADMIN");
  const citizen = requireRole("CITIZEN");
  const staff = requireRole("OFFICER", "ADMIN");

  // Public route; the service itself requires a signed-in caller (citizenId must name a user).
  r.post("/api/v1/appointments", async (req, res) => {
    ok(res, 201, "Appointment booked successfully.", await appointments.book(req.caller, body(req)));
  });
  r.get("/api/v1/appointments/track", async (req, res) => {
    ok(res, 200, "Appointment found.", await appointments.track(q(req, "ref")));
  });
  r.get("/api/v1/appointments/my", citizen, async (req, res) => {
    ok(res, 200, "Appointments retrieved successfully.", await appointments.mine(req.caller, q(req, "tab"), q(req, "search")));
  });
  r.get("/api/v1/appointments", staff, async (req, res) => {
    const f = listFilter(req);
    const { page, limit } = normalizePage(f.page, f.limit);
    const { items, total } = await appointments.list(req.caller, { ...f, page, limit });
    // Go's OKWithMeta: meta holds pagination and timestamp (no version).
    res.status(200).json({
      success: true, message: "List retrieved successfully.", data: items,
      meta: { pagination: pagination(total, page, limit), timestamp: timestamp() },
    });
  });
  r.patch("/api/v1/appointments/:id/status", staff, async (req, res) => {
    const a = await appointments.review(req.caller, req.params.id, body(req));
    ok(res, 200, `Appointment status updated to ${a.status}.`, a);
  });
  r.post("/api/v1/appointments/:id/reschedule", signedIn, async (req, res) => {
    ok(res, 200, "Appointment rescheduled.", await appointments.reschedule(req.caller, req.params.id, body(req)));
  });
  r.post("/api/v1/appointments/:id/cancel", signedIn, async (req, res) => {
    await appointments.cancel(req.caller, req.params.id);
    ok(res, 200, "Appointment cancelled.", { id: req.params.id, status: "CANCELLED" });
  });
  r.get("/api/v1/appointments/:id/slip", async (req, res) => {
    ok(res, 200, "Slip generated.", await appointments.slip(req.params.id));
  });

  r.get("/api/v1/reports/summary", staff, async (req, res) => {
    ok(res, 200, "Summary retrieved successfully.", await appointments.summary(req.caller, q(req, "period"), q(req, "departmentId")));
  });
  // TODO (as in Go): stream with a cursor instead of loading a capped page.
  r.get("/api/v1/reports/export-csv", staff, async (req, res) => {
    const { items } = await appointments.list(req.caller, { ...listFilter(req), page: 1, limit: 200 });
    res.status(200)
      .set("Content-Type", "text/csv; charset=utf-8")
      .set("Content-Disposition", 'attachment; filename="woreda_appointment_report.csv"')
      .send(appointmentsCsv(items));
  });

  return r;
}
