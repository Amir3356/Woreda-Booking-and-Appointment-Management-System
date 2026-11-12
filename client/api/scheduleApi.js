import { http } from "./httpClient";

// Module 5: /schedules (working hours) and Admin > Schedule Management.
export const scheduleApi = {
  // ---- working hours ----
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
  /** Same as availability, retried once after a short pause when the request fails (e.g. a brief network blip). */
  availabilityWithRetry: async (params) => {
    try {
      return await http.get("/schedules/availability", params);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return http.get("/schedules/availability", params);
    }
  },
  /** Which dates can be booked. @param {{ serviceId: string, from: string, to: string }} params */
  bookableDates: (params) => http.get("/schedules/bookable-dates", params),

  // ---- Schedule Management (changes: administrator only; reads: staff, own department for officers) ----
  /** Per-day status for each department. @param {{ from: string, to: string, departmentId?: string }} params */
  calendar: (params) => http.get("/schedules/calendar", params),
  /** Outstanding appointments a change would touch. @param {{ from, to, departmentIds?: string }} params */
  impact: (params) => http.get("/schedules/impact", params),
  exceptions: (params) => http.get("/schedules/exceptions", params),
  createException: (payload) => http.post("/schedules/exceptions", payload),
  updateException: (id, payload) => http.put(`/schedules/exceptions/${id}`, payload),
  removeException: (id) => http.delete(`/schedules/exceptions/${id}`),
};
