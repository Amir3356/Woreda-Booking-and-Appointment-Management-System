// All HTTP routes of auth-service.
import { Router } from "express";
import { createAuthRoutes } from "./auth.routes.js";

export function createRoutes({ authController }) {
  const router = Router();
  router.get("/healthz", (_req, res) => res.status(200).end());
  router.use("/api/v1/auth", createAuthRoutes(authController));
  return router;
}
