import { http } from "./httpClient";

// /audit-logs (ADMIN): appointment decision trail
export const auditApi = {
  /** params: { page, limit, action, departmentId, search } */
  list: (params) => http.get("/audit-logs", params),
};
