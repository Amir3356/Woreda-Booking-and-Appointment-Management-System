// Authentication and role checks. Tokens are HS256 JWTs (claims sub, jti, name, role, dept) sent as
// "Authorization: Bearer <token>" or in the woreda_token cookie. A signed-out (revoked) token counts as none.
import { verifyToken } from "../utils/token.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";

export const AUTH_COOKIE_NAME = "woreda_token";

const ANONYMOUS = Object.freeze({ userId: "", role: "", name: "", departmentId: "", tokenId: "", authenticated: false });

/** Value of the first cookie called name (surrounding quotes removed), or "". */
export function readCookie(header, name) {
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0 || part.slice(0, i).trim() !== name) continue;
    let v = part.slice(i + 1).trim();
    if (v.length > 1 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return "";
}

/**
 * Puts req.caller on every request. A missing, invalid or revoked token continues anonymously;
 * requireRole decides whether a route needs a signed-in user, so public routes keep working.
 * isRevoked(jti): async check against the signed-out tokens.
 */
export function authenticate(secret, isRevoked) {
  return async (req, _res, next) => {
    req.caller = ANONYMOUS;
    const header = req.get("Authorization") || "";
    const raw = header.startsWith("Bearer ") ? header.slice(7) : readCookie(req.headers.cookie, AUTH_COOKIE_NAME);
    const c = raw ? verifyToken(secret, raw) : null;
    if (c?.sub && !(await isRevoked(c.jti))) {
      req.caller = { userId: c.sub, role: c.role || "", name: c.name || "", departmentId: c.dept || "", tokenId: c.jti || "", authenticated: true };
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

/** Any signed-in user. */
export const signedIn = requireRole("CITIZEN", "OFFICER", "ADMIN");
