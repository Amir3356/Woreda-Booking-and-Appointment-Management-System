// /api/v1/departments.
import { ok, okWithCursor } from "../utils/response.js";

export function createDepartmentController(departmentService) {
  return {
    async list(req, res) {
      const { isActive, status, departmentId, search, cursor, pageSize } = req.validatedQuery;
      let activeFilter = isActive;
      if (status) {
        const s = status.toLowerCase();
        if (s === "active") activeFilter = true;
        else if (s === "inactive") activeFilter = false;
        else if (s === "all") activeFilter = undefined;
      }

      const isPaged = cursor !== undefined || pageSize !== undefined;
      if (isPaged) {
        const pageLimit = pageSize ?? 3;
        const pageCursor = cursor ?? 0;
        const { items, cursor: metaCursor } = await departmentService.listPaged({
          isActive: activeFilter,
          departmentId: departmentId && departmentId !== "ALL" ? departmentId : undefined,
          search: search || "",
          cursor: pageCursor,
          pageSize: pageLimit,
        });
        return okWithCursor(res, "Departments retrieved successfully.", items, metaCursor);
      }

      ok(
        res,
        200,
        "Departments retrieved successfully.",
        await departmentService.list({
          isActive: activeFilter,
          departmentId: departmentId && departmentId !== "ALL" ? departmentId : undefined,
          search: search || "",
        })
      );
    },
    async create(req, res) {
      ok(res, 201, "Department created successfully.", await departmentService.create(req.body));
    },
    async update(req, res) {
      ok(res, 200, "Department updated successfully.", await departmentService.update(req.params.id, req.body));
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
