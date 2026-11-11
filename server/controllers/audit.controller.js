// /api/v1/audit-logs.
import { okPage } from "../utils/response.js";

export function createAuditController(auditService) {
  return {
    async list(req, res) {
      const { items, pagination } = await auditService.list(req.validatedQuery);
      okPage(res, "Audit log retrieved successfully.", items, pagination);
    },
  };
}
