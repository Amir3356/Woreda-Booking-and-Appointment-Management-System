// /api/v1/schedules: operating hours, Schedule Management (exceptions, availability, capacities,
// calendar views, impact) and the public bookable list, slot availability and bookable dates.
import { ok, okWithCursor } from "../utils/response.js";

export function createScheduleController({ scheduleService, availabilityService, scheduleManagementService: mgmt }) {
  return {
    // ---- operating hours ----
    async list(req, res) {
      const { search, status, cursor, pageSize } = req.validatedQuery;
      if (cursor !== undefined || pageSize !== undefined) {
        const { items, cursor: metaCursor } = await scheduleService.listPaged(req.caller, {
          search,
          status,
          cursor: cursor ?? 0,
          pageSize: pageSize ?? 5,
        });
        return okWithCursor(res, "Schedules retrieved successfully.", items, metaCursor);
      }
      ok(res, 200, "Schedules retrieved successfully.", await scheduleService.list(req.caller));
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

    // ---- public booking ----
    async availability(req, res) {
      ok(res, 200, "Availability calculated.", await availabilityService.availability(req.validatedQuery));
    },
    async bookableDates(req, res) {
      ok(res, 200, "Bookable dates calculated.", await availabilityService.bookableDates(req.validatedQuery));
    },

    // ---- calendar exceptions ----
    async listExceptions(req, res) {
      const { cursor, pageSize, ...filters } = req.validatedQuery;
      if (cursor !== undefined || pageSize !== undefined) {
        const { items, cursor: metaCursor } = await mgmt.listExceptionsPaged(req.caller, {
          ...filters,
          cursor: cursor ?? 0,
          pageSize: pageSize ?? 5,
        });
        return okWithCursor(res, "Calendar exceptions retrieved successfully.", items, metaCursor);
      }
      ok(res, 200, "Calendar exceptions retrieved successfully.", await mgmt.listExceptions(req.caller, filters));
    },
    async createException(req, res) {
      ok(res, 201, "Calendar exception created successfully.", await mgmt.createException(req.caller, req.body));
    },
    async updateException(req, res) {
      ok(res, 200, "Calendar exception updated successfully.", await mgmt.updateException(req.params.id, req.body));
    },
    async removeException(req, res) {
      await mgmt.removeException(req.params.id);
      ok(res, 200, "Calendar exception deleted successfully.", null);
    },

    // ---- appointment availability, capacities, calendar, impact ----
    async setDateAvailability(req, res) {
      const result = await mgmt.setDateAvailability(req.caller, req.body);
      ok(res, 200, result.enabled ? "Booking enabled for the selected dates." : "Booking disabled for the selected dates.", result);
    },
    async listCapacities(req, res) {
      ok(res, 200, "Daily capacities retrieved successfully.", await mgmt.listCapacities(req.caller));
    },
    async setCapacity(req, res) {
      ok(res, 200, "Daily capacity updated successfully.", await mgmt.setCapacity(req.caller, req.params.departmentId, req.body.dailyCapacity));
    },
    async calendar(req, res) {
      ok(res, 200, "Calendar retrieved successfully.", await mgmt.calendar(req.caller, req.validatedQuery));
    },
    async impact(req, res) {
      ok(res, 200, "Impact calculated.", await mgmt.impact(req.validatedQuery));
    },
  };
}
