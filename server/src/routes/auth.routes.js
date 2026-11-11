// /api/v1/auth: register and login are public; me and logout need a signed-in user.
import { Router } from "express";
import { signedIn } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../validations/auth.validation.js";

export function createAuthRoutes(c) {
  const router = Router();
  router.post("/register", validate({ body: registerSchema }), c.register);
  router.post("/login", validate({ body: loginSchema }), c.login);
  router.get("/me", signedIn, c.me);
  router.post("/logout", signedIn, c.logout);
  return router;
}
