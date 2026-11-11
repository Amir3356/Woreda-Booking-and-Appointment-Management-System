// /api/v1/auth: register and login are public; me and logout need a signed-in user.
import { Router } from "express";
import { verifyJwtToken } from "../middleware/jwt.js";
import { checkAbility } from "../middleware/casl.js";
import { Actions, Subjects } from "../security/abilities.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../validations/auth.validation.js";

export function createAuthRoutes(c) {
  const router = Router();
  router.get("/csrf", c.csrf);
  router.post("/register", validate({ body: registerSchema }), c.register);
  router.post("/login", validate({ body: loginSchema }), c.login);
  router.get("/me", verifyJwtToken, checkAbility(Actions.READ, Subjects.AUTH), c.me);
  router.post("/logout", verifyJwtToken, checkAbility(Actions.DELETE, Subjects.AUTH), c.logout);
  return router;
}
