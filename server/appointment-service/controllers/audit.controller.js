// HTTP handler for /api/v1/audit-logs.
import { okPage, query } from "../utils/response.js";
import { atoi } from "../utils/pagination.js";

export function createAuditController(auditService) {
  return {
    async list(req, res) {
      const { items, pagination } = await auditService.list({
        action: query(req, "action"), departmentId: query(req, "departmentId"), search: query(req, "search"),
        page: atoi(query(req, "page")), limit: atoi(query(req, "limit")),
      });
      okPage(res, "Audit log retrieved successfully.", items, pagination);
    },
  };
}
