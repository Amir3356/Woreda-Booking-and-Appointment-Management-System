import { http } from "./httpClient";

// /audit-logs (ADMIN): appointment decision trail
export const auditApi = {
  /** params: { cursor, pageSize, action, departmentId, search }; meta.cursor holds prevCursor/nextCursor */
  list: (params) => http.get("/audit-logs", params),
};
