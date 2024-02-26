// HTTP handlers for /api/v1/admin/users: read the request, call the service, send the envelope.
import { body, ok, okWithCursor } from "../utils/response.js";

export function createStaffController(staffService) {
  return {
    async list(req, res) {
      const { items, cursor } = await staffService.list(req.query.search, req.query.cursor, req.query.pageSize);
      okWithCursor(res, "Accounts retrieved successfully.", items, cursor);
    },
    async provision(req, res) {
      ok(res, 201, "Staff account provisioned successfully.", { id: await staffService.provision(body(req)) });
    },
    async toggleStatus(req, res) {
      ok(res, 200, "Account status updated.", { id: req.params.id, isActive: await staffService.toggleStatus(req.params.id) });
    },
    async remove(req, res) {
      await staffService.remove(req.params.id);
      ok(res, 200, "Account deleted.", null);
    },
  };
}
