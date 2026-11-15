// /api/v1/audit-logs.
import { okWithCursor } from "../utils/response.js";

export function createAuditController(auditService) {
  return {
    async list(req, res) {
      const { items, cursor } = await auditService.list(req.validatedQuery);
      okWithCursor(res, "Audit log retrieved successfully.", items, cursor);
    },
  };
}
