// HTTP handlers for /api/v1/schedules: read the request, call the service, send the envelope.
import { body, ok } from "../utils/response.js";

export function createScheduleController({ scheduleService, availabilityService }) {
  return {
    async list(_req, res) {
      ok(res, 200, "Schedules retrieved successfully.", await scheduleService.list());
    },
    async listBookable(_req, res) {
      ok(res, 200, "Schedules retrieved successfully.", await scheduleService.listBookable());
    },
    async create(req, res) {
      ok(res, 201, "Schedule created successfully.", await scheduleService.create(body(req)));
    },
    async update(req, res) {
      ok(res, 200, "Schedule updated successfully.", await scheduleService.update(req.params.id, body(req)));
    },
    async toggleStatus(req, res) {
      ok(res, 200, "Schedule status updated.", await scheduleService.toggle(req.params.id));
    },
    async remove(req, res) {
      await scheduleService.remove(req.params.id);
      ok(res, 200, "Schedule deleted successfully.", null);
    },
    async availability(req, res) {
      const out = await availabilityService.availability(String(req.query.serviceId ?? ""), String(req.query.date ?? ""));
      ok(res, 200, "Availability calculated.", out);
    },
  };
}
