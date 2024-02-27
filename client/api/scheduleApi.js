import { http } from "./httpClient";

// Module 5: /schedules
export const scheduleApi = {
  list: (params) => http.get("/schedules", params),
  create: (payload) => http.post("/schedules", payload),
  update: (id, payload) => http.put(`/schedules/${id}`, payload),
  toggleStatus: (id) => http.patch(`/schedules/${id}/status`),
  remove: (id) => http.delete(`/schedules/${id}`),
  /** Public: ACTIVE schedules that have not ended (citizen booking form). */
  active: () => http.get("/schedules/active"),
  /** @param {{ serviceId: string, date: string }} params */
  availability: (params) => http.get("/schedules/availability", params),
};
