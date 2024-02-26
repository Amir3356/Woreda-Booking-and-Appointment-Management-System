// HTTP handlers for /api/v1/services: read the request, call the service, send the envelope.
import { body, boolQuery, ok } from "../utils/response.js";

export function createPublicServiceController(publicServiceService) {
  return {
    async list(req, res) {
      const list = await publicServiceService.list({
        departmentId: String(req.query.departmentId ?? ""),
        search: String(req.query.search ?? ""),
        isActive: boolQuery(req, "isActive"),
      });
      ok(res, 200, "Services retrieved successfully.", list);
    },
    async create(req, res) {
      ok(res, 201, "Service created successfully.", await publicServiceService.create(body(req)));
    },
    async update(req, res) {
      ok(res, 200, "Service updated successfully.", await publicServiceService.update(req.params.id, body(req)));
    },
    async toggleStatus(req, res) {
      ok(res, 200, "Service status updated.", { id: req.params.id, isActive: await publicServiceService.toggle(req.params.id) });
    },
    async remove(req, res) {
      await publicServiceService.remove(req.params.id);
      ok(res, 200, "Service deleted.", null);
    },
  };
}
