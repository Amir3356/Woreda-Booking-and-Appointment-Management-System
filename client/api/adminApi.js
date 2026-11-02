import { http, request } from "./httpClient";

// Modules 9–12: staff provisioning, reports, audit trail, municipal settings
export const staffApi = {
  list: (params) => http.get("/admin/users", params),
  provision: (payload) => http.post("/admin/users/provision", payload),
  toggleStatus: (id) => http.patch(`/admin/users/${id}/status`),
  remove: (id) => http.delete(`/admin/users/${id}`),
};

export const reportApi = {
  summary: (params) => http.get("/reports/summary", params),
  /** Returns the raw Response so the caller can read it as a CSV blob. */
  exportCsv: (params) => request("GET", "/reports/export-csv", { params, raw: true }),
};

export const auditApi = {
  list: (params) => http.get("/admin/audit-logs", params),
};

export const settingsApi = {
  get: () => http.get("/admin/settings"),
  update: (payload) => http.put("/admin/settings", payload),
};
