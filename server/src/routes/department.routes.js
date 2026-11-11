// /api/v1/departments (public list; changes need ADMIN).
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { departmentListQuery, departmentSchema } from "../validations/catalog.validation.js";

export function createDepartmentRoutes(c) {
  const router = Router();
  const admin = requireRole("ADMIN");
  const body = validate({ body: departmentSchema });
  router.get("/", validate({ query: departmentListQuery }), c.list);
  router.post("/", admin, body, c.create);
  router.put("/:id", admin, body, c.update);
  router.patch("/:id/status", admin, c.toggleStatus);
  router.delete("/:id", admin, c.remove);
  return router;
}
