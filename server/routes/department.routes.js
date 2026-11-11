// /api/v1/departments (public list; changes need ADMIN).
import { Router } from "express";
import { checkAbility } from "../middleware/casl.js";
import { Actions, Subjects } from "../security/abilities.js";
import { validate } from "../middleware/validate.js";
import { departmentListQuery, departmentSchema } from "../validations/catalog.validation.js";

export function createDepartmentRoutes(c) {
  const router = Router();
  const canCreate = checkAbility(Actions.CREATE, Subjects.DEPARTMENT);
  const canUpdate = checkAbility(Actions.UPDATE, Subjects.DEPARTMENT);
  const canDelete = checkAbility(Actions.DELETE, Subjects.DEPARTMENT);
  const body = validate({ body: departmentSchema });

  router.get("/", validate({ query: departmentListQuery }), c.list);
  router.post("/", canCreate, body, c.create);
  router.put("/:id", canUpdate, body, c.update);
  router.patch("/:id/status", canUpdate, c.toggleStatus);
  router.delete("/:id", canDelete, c.remove);
  return router;
}
