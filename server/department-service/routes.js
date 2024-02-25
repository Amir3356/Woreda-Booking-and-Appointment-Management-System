// /api/v1/departments and /api/v1/services (API.md module 3 and 4).
import { Router, body, boolQuery, ok, requireRole } from "./lib/index.js";

export function catalogRoutes(catalog) {
  const r = Router();
  const admin = requireRole("ADMIN");

  r.get("/api/v1/departments", async (req, res) => {
    ok(res, 200, "Departments retrieved successfully.", await catalog.listDepartments(boolQuery(req, "isActive")));
  });
  r.post("/api/v1/departments", admin, async (req, res) => {
    ok(res, 201, "Department created successfully.", await catalog.createDepartment(body(req)));
  });
  r.put("/api/v1/departments/:id", admin, async (req, res) => {
    ok(res, 200, "Department updated successfully.", await catalog.updateDepartment(req.params.id, body(req)));
  });
  r.patch("/api/v1/departments/:id/status", admin, async (req, res) => {
    ok(res, 200, "Department status updated.", { id: req.params.id, isActive: await catalog.toggleDepartment(req.params.id) });
  });
  r.delete("/api/v1/departments/:id", admin, async (req, res) => {
    await catalog.deleteDepartment(req.params.id);
    ok(res, 200, "Department deleted.", null);
  });

  r.get("/api/v1/services", async (req, res) => {
    const list = await catalog.listServices({
      departmentId: String(req.query.departmentId ?? ""),
      search: String(req.query.search ?? ""),
      isActive: boolQuery(req, "isActive"),
    });
    ok(res, 200, "Services retrieved successfully.", list);
  });
  r.post("/api/v1/services", admin, async (req, res) => {
    ok(res, 201, "Service created successfully.", await catalog.createService(body(req)));
  });
  r.put("/api/v1/services/:id", admin, async (req, res) => {
    ok(res, 200, "Service updated successfully.", await catalog.updateService(req.params.id, body(req)));
  });
  r.patch("/api/v1/services/:id/status", admin, async (req, res) => {
    ok(res, 200, "Service status updated.", { id: req.params.id, isActive: await catalog.toggleService(req.params.id) });
  });
  r.delete("/api/v1/services/:id", admin, async (req, res) => {
    await catalog.deleteService(req.params.id);
    ok(res, 200, "Service deleted.", null);
  });

  return r;
}
