import { http } from "./httpClient";

// Module 4: /services (public service catalog)
export const serviceApi = {
  list: (params) => http.get("/services", params),
  listPaged: ({ search = "", departmentId = "ALL", status = "ALL", cursor = 0, pageSize = 4 } = {}) =>
    http.get("/services", {
      search: search?.trim() || undefined,
      departmentId: departmentId && departmentId !== "ALL" ? departmentId : undefined,
      status: status !== "ALL" ? status : undefined,
      cursor,
      pageSize,
    }),
  create: (payload) => http.post("/services", payload),
  update: (id, payload) => http.put(`/services/${id}`, payload),
  toggleStatus: (id) => http.patch(`/services/${id}/status`),
  remove: (id) => http.delete(`/services/${id}`),
};
