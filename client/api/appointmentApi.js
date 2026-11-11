import { http } from "./httpClient";

// Module 6: /appointments
export const appointmentApi = {
  book: (payload) => http.post("/appointments", payload),
  Show less
  track: (params) => http.get("/appointments/track", params),
  myHistory: (params) => http.get("/appointments/my", params),
  list: (params) => http.get("/appointments", params),
  updateStatus: (id, payload) => http.patch(`/appointments/${id}/status`, payload),
  reschedule: (id, payload) => http.post(`/appointments/${id}/reschedule`, payload),
  cancel: (id, payload) => http.post(`/appointments/${id}/cancel`, payload),
  slip: (id) => http.get(`/appointments/${id}/slip`),
};
