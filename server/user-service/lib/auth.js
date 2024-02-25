// JWT checks shared by every service. auth-service issues HS256 tokens with the claims
// sub, jti, name, role, dept; the gateway verifies them too, but services re-check.
import jwt from "jsonwebtoken";
import { ForbiddenError, UnauthorizedError } from "./errors.js";

export const ROLES = Object.freeze({ CITIZEN: "CITIZEN", OFFICER: "OFFICER", ADMIN: "ADMIN" });

/** The signed-in user, or an anonymous caller with userId "". */
export function anonymous() {
  return { userId: "", role: "", name: "", departmentId: "", tokenId: "", authenticated: false };
}

/** Puts req.caller on every request. Invalid or missing tokens continue anonymously;
 *  requireRole decides whether a route needs a signed-in user, so public routes keep working. */
export function authenticate(secret) {
  return (req, _res, next) => {
    req.caller = anonymous();
    const header = req.get("Authorization") || "";
    if (header.startsWith("Bearer ")) {
      try {
        const c = jwt.verify(header.slice(7), secret, { algorithms: ["HS256"] });
        req.caller = {
          userId: c.sub || "", role: c.role || "", name: c.name || "",
          departmentId: c.dept || "", tokenId: c.jti || "", authenticated: Boolean(c.sub),
        };
      } catch {
        // invalid or expired: stays anonymous
      }
    }
    next();
  };
}

/** 401 for anonymous callers, 403 for roles not listed. With no roles, any signed-in user passes. */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.caller?.authenticated) return next(new UnauthorizedError());
    if (roles.length > 0 && !roles.includes(req.caller.role)) return next(new ForbiddenError());
    next();
  };
}
