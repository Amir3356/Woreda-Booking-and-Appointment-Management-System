// /api/v1/citizen/profile (CITIZEN only).
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";

export function createProfileRoutes(controller) {
  const router = Router();
  const citizen = requireRole("CITIZEN");
  router.get("/", citizen, controller.get);
  router.put("/", citizen, controller.update);
  return router;
}
