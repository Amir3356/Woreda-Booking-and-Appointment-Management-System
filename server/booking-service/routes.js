// /api/v1/schedules and /api/v1/queue (API.md module 5 and 6).
import { Router, body, ok, requireRole } from "./lib/index.js";

const query = (req, key) => String(req.query[key] ?? "");

export function bookingRoutes(schedules, queue) {
  const r = Router();
  const admin = requireRole("ADMIN");
  const staff = requireRole("ADMIN", "OFFICER");
  const officer = requireRole("OFFICER");

  r.get("/api/v1/schedules", staff, async (_req, res) => {
    ok(res, 200, "Schedules retrieved successfully.", await schedules.list());
  });
  r.post("/api/v1/schedules", admin, async (req, res) => {
    ok(res, 201, "Schedule created successfully.", await schedules.create(body(req)));
  });
  // Public: the citizen booking page shows slot availability before sign-in.
  r.get("/api/v1/schedules/availability", async (req, res) => {
    ok(res, 200, "Availability calculated.", await schedules.availability(query(req, "serviceId"), query(req, "date")));
  });

  r.post("/api/v1/queue/verify-checkin", officer, async (req, res) => {
    ok(res, 200, "Citizen checked in and queue token issued.", await queue.checkIn(req.caller, body(req)));
  });
  r.get("/api/v1/queue", officer, async (req, res) => {
    ok(res, 200, "Queue retrieved successfully.", await queue.board(req.caller, query(req, "departmentId")));
  });
  r.post("/api/v1/queue/call-next", officer, async (req, res) => {
    const out = await queue.callNext(req.caller, body(req));
    ok(res, 200, `Token ${out.calledToken} called to Counter #${out.counterNumber}.`, out);
  });
  r.patch("/api/v1/queue/:id/status", officer, async (req, res) => {
    ok(res, 200, "Queue token finalized.", await queue.finalize(req.caller, req.params.id, body(req)));
  });

  return r;
}
