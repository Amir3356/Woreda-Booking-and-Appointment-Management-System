// /api/v1/services (public list; changes need ADMIN).
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { publicServiceListQuery, publicServiceSchema } from "../validations/catalog.validation.js";

export function createPublicServiceRoutes(c) {
  const router = Router();
  const admin = requireRole("ADMIN");
  const body = validate({ body: publicServiceSchema });
  router.get("/", validate({ query: publicServiceListQuery }), c.list);
  router.post("/", admin, body, c.create);
  router.put("/:id", admin, body, c.update);
  router.patch("/:id/status", admin, c.toggleStatus);
  router.delete("/:id", admin, c.remove);
  return router;
}
