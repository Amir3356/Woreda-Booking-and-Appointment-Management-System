// /api/v1/services (public list; changes need ADMIN).
import { Router } from "express";
import { checkAbility } from "../middleware/casl.js";
import { Actions, Subjects } from "../security/abilities.js";
import { validate } from "../middleware/validate.js";
import { publicServiceListQuery, publicServiceSchema } from "../validations/catalog.validation.js";

export function createPublicServiceRoutes(c) {
  const router = Router();
  const canCreate = checkAbility(Actions.CREATE, Subjects.SERVICE);
  const canUpdate = checkAbility(Actions.UPDATE, Subjects.SERVICE);
  const canDelete = checkAbility(Actions.DELETE, Subjects.SERVICE);
  const body = validate({ body: publicServiceSchema });

  router.get("/", validate({ query: publicServiceListQuery }), c.list);
  router.post("/", canCreate, body, c.create);
  router.put("/:id", canUpdate, body, c.update);
  router.patch("/:id/status", canUpdate, c.toggleStatus);
  router.delete("/:id", canDelete, c.remove);
  return router;
}
