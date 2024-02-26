// HTTP handlers for /api/v1/departments: read the request, call the service, send the envelope.
import { body, boolQuery, ok } from "../utils/response.js";

export function createDepartmentController(departmentService) {
  return {
    async list(req, res) {
      ok(res, 200, "Departments retrieved successfully.", await departmentService.list(boolQuery(req, "isActive")));
    },
    async create(req, res) {
      ok(res, 201, "Department created successfully.", await departmentService.create(body(req)));
    },
    async update(req, res) {
      ok(res, 200, "Department updated successfully.", await departmentService.update(req.params.id, body(req)));
    },
    async toggleStatus(req, res) {
      ok(res, 200, "Department status updated.", { id: req.params.id, isActive: await departmentService.toggle(req.params.id) });
    },
    async remove(req, res) {
      await departmentService.remove(req.params.id);
      ok(res, 200, "Department deleted.", null);
    },
  };
}
