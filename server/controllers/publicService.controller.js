// /api/v1/services.
import { ok, okWithCursor } from "../utils/response.js";

export function createPublicServiceController(publicServiceService) {
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
        const pageLimit = pageSize ?? 4;
        const pageCursor = cursor ?? 0;
        const { items, cursor: metaCursor } = await publicServiceService.listPaged({
          isActive: activeFilter,
          departmentId: departmentId && departmentId !== "ALL" ? departmentId : undefined,
          search: search || "",
          cursor: pageCursor,
          pageSize: pageLimit,
        });
        return okWithCursor(res, "Services retrieved successfully.", items, metaCursor);
      }

      ok(
        res,
        200,
        "Services retrieved successfully.",
        await publicServiceService.list({
          isActive: activeFilter,
          departmentId: departmentId && departmentId !== "ALL" ? departmentId : undefined,
          search: search || "",
        })
      );
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
