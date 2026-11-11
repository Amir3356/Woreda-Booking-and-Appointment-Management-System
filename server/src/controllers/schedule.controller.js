// /api/v1/schedules (including the public bookable list and slot availability).
import { ok } from "../utils/response.js";

export function createScheduleController({ scheduleService, availabilityService }) {
  return {
    async list(_req, res) {
      ok(res, 200, "Schedules retrieved successfully.", await scheduleService.list());
    },
    async listBookable(_req, res) {
      ok(res, 200, "Schedules retrieved successfully.", await scheduleService.listBookable());
    },
    async create(req, res) {
      ok(res, 201, "Schedule created successfully.", await scheduleService.create(req.body));
    },
    async update(req, res) {
      ok(res, 200, "Schedule updated successfully.", await scheduleService.update(req.params.id, req.body));
    },
    async toggleStatus(req, res) {
      ok(res, 200, "Schedule status updated.", await scheduleService.toggle(req.params.id));
    },
    async remove(req, res) {
      await scheduleService.remove(req.params.id);
      ok(res, 200, "Schedule deleted successfully.", null);
    },
    async availability(req, res) {
      ok(res, 200, "Availability calculated.", await availabilityService.availability(req.validatedQuery));
    },
  };
}
