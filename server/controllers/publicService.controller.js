// /api/v1/services.
import { ok } from "../utils/response.js";

export function createPublicServiceController(publicServiceService) {
  return {
    async list(req, res) {
      ok(res, 200, "Services retrieved successfully.", await publicServiceService.list(req.validatedQuery));
    },
    async create(req, res) {
      ok(res, 201, "Service created successfully.", await publicServiceService.create(req.body));
    },
    async update(req, res) {
      ok(res, 200, "Service updated successfully.", await publicServiceService.update(req.params.id, req.body));
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
