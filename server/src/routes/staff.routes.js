// /api/v1/admin/users (ADMIN only).
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { provisionSchema, staffListQuery } from "../validations/user.validation.js";

export function createStaffRoutes(c) {
  const router = Router();
  const admin = requireRole("ADMIN");
  router.get("/", admin, validate({ query: staffListQuery }), c.list);
  router.post("/provision", admin, validate({ body: provisionSchema }), c.provision);
  router.patch("/:id/status", admin, c.toggleStatus);
  router.delete("/:id", admin, c.remove);
  return router;
}
