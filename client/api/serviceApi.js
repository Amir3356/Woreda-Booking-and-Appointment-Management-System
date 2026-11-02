import { http } from "./httpClient";

// Module 4: /services (public service catalog)
export const serviceApi = {
  list: (params) => http.get("/services", params),
  create: (payload) => http.post("/services", payload),
  update: (id, payload) => http.put(`/services/${id}`, payload),
  toggleStatus: (id) => http.patch(`/services/${id}/status`),
  remove: (id) => http.delete(`/services/${id}`),
};
