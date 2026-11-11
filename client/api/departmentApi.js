import { http } from "./httpClient";

// Module 3: /departments
export const departmentApi = {
  list: (params) => http.get("/departments", params),
  listPaged: ({ search = "", departmentId = "ALL", status = "ALL", cursor = 0, pageSize = 3 } = {}) =>
    http.get("/departments", {
      search: search?.trim() || undefined,
      departmentId: departmentId && departmentId !== "ALL" ? departmentId : undefined,
      status: status !== "ALL" ? status : undefined,
      cursor,
      pageSize,
    }),
  create: (payload) => http.post("/departments", payload),
  update: (id, payload) => http.put(`/departments/${id}`, payload),
  toggleStatus: (id) => http.patch(`/departments/${id}/status`),
  remove: (id) => http.delete(`/departments/${id}`),
};
