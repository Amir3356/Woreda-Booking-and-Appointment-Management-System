import { http } from "./httpClient";

// Module 5: /schedules (operating hours) and Admin > Schedule Management.
export const scheduleApi = {
  // ---- operating hours ----
  list: (params) => http.get("/schedules", params),
  create: (payload) => http.post("/schedules", payload),
  update: (id, payload) => http.put(`/schedules/${id}`, payload),
  toggleStatus: (id) => http.patch(`/schedules/${id}/status`),
  remove: (id) => http.delete(`/schedules/${id}`),

  // ---- public (citizen booking) ----
  /** ACTIVE schedules that have not ended (citizen booking form). */
  active: () => http.get("/schedules/active"),
  /** @param {{ serviceId: string, date: string }} params */
  availability: (params) => http.get("/schedules/availability", params),
  /** Which dates can be booked. @param {{ serviceId: string, from: string, to: string }} params */
  bookableDates: (params) => http.get("/schedules/bookable-dates", params),

  // ---- Schedule Management (changes: administrator only; reads: staff, own department for officers) ----
  /** Per-day status for each department. @param {{ from: string, to: string, departmentId?: string }} params */
  calendar: (params) => http.get("/schedules/calendar", params),
  /** Outstanding appointments a change would touch. @param {{ from, to, departmentIds?: string }} params */
  impact: (params) => http.get("/schedules/impact", params),
  /** @param {{ departmentIds: string[], startDate, endDate, enabled: boolean, reason?: string }} payload */
  setDateAvailability: (payload) => http.put("/schedules/date-availability", payload),
  capacities: () => http.get("/schedules/capacities"),
  /** dailyCapacity null removes the department limit. */
  setCapacity: (departmentId, dailyCapacity) => http.put(`/schedules/capacities/${departmentId}`, { dailyCapacity }),
  exceptions: (params) => http.get("/schedules/exceptions", params),
  createException: (payload) => http.post("/schedules/exceptions", payload),
  updateException: (id, payload) => http.put(`/schedules/exceptions/${id}`, payload),
  removeException: (id) => http.delete(`/schedules/exceptions/${id}`),
};
