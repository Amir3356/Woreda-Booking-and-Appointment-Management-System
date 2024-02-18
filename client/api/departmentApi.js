import { http } from "./httpClient";

// Module 3: /departments
export const departmentApi = {
  list: (params) => http.get("/departments", params),
  create: (payload) => http.post("/departments", payload),
  update: (id, payload) => http.put(`/departments/${id}`, payload),
  toggleStatus: (id) => http.patch(`/departments/${id}/status`),
  remove: (id) => http.delete(`/departments/${id}`),
};
