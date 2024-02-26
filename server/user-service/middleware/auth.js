// JWT checks. auth-service issues HS256 tokens with claims sub, jti, name, role, dept.
import jwt from "jsonwebtoken";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

/** Puts req.caller on every request. A missing or invalid token continues anonymously;
 *  requireRole decides whether a route needs a signed-in user, so public routes keep working. */
export function authenticate(secret) {
  return (req, _res, next) => {
    req.caller = { userId: "", role: "", name: "", departmentId: "", tokenId: "", authenticated: false };
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

/** 401 for anonymous callers, 403 when the role is not listed (no roles = any signed-in user). */
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.caller?.authenticated) return next(new UnauthorizedError());
    if (roles.length > 0 && !roles.includes(req.caller.role)) return next(new ForbiddenError());
    next();
  };
}
