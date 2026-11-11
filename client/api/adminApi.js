import { http, request } from "./httpClient";

// Modules 9–11: staff provisioning, reports, municipal settings
export const staffApi = {
  list: ({ search = "", role = "ALL", departmentId = "ALL", cursor = 0, pageSize = 4 } = {}) =>
    http.get("/admin/users", {
      search: search?.trim() || undefined,
      role: role && role !== "ALL" ? role : undefined,
      departmentId: departmentId && departmentId !== "ALL" ? departmentId : undefined,
      cursor,
      pageSize,
    }),
  listCitizens: ({ search = "", woreda = "ALL", kebele = "ALL", location = "ALL", cursor = 0, pageSize = 5 } = {}) =>
    http.get("/admin/users/citizens", {
      search: search?.trim() || undefined,
      woreda: woreda && woreda !== "ALL" ? woreda : undefined,
      kebele: kebele && kebele !== "ALL" ? kebele : undefined,
      location: location && location !== "ALL" ? location : undefined,
      cursor,
      pageSize,
    }),
  provision: (payload) => http.post("/admin/users/provision", payload),
  update: (id, payload) => http.put(`/admin/users/${id}`, payload),
  toggleStatus: (id) => http.patch(`/admin/users/${id}/status`),
  remove: (id) => http.delete(`/admin/users/${id}`),
};

export const reportApi = {
  summary: (params) => http.get("/reports/summary", params),
  /** Returns the raw Response so the caller can read it as a CSV blob. */
  exportCsv: (params) => request("GET", "/reports/export-csv", { params, raw: true }),
};

export const settingsApi = {
  get: () => http.get("/admin/settings"),
  update: (payload) => http.put("/admin/settings", payload),
};
