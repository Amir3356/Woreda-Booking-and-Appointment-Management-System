// /api/v1/auth (API.md module 1): register and login are public; me and logout need a signed-in user.
import { Router } from "express";
import { requireRole } from "../middleware/auth.js";

export function createAuthRoutes(controller) {
  const router = Router();
  const signedIn = requireRole("CITIZEN", "OFFICER", "ADMIN");
  router.post("/register", controller.register);
  router.post("/login", controller.login);
  router.get("/me", signedIn, controller.me);
  router.post("/logout", signedIn, controller.logout);
  return router;
}
