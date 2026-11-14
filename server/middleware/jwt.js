// Express JWT Middleware to extract, verify, and enforce JWT tokens.
// Reads Bearer tokens from the Authorization header or from the woreda_token cookie.
import { verifyToken as verifyJwtClaims } from "../utils/token.js";
import { UnauthorizedError } from "../utils/errors.js";
import { defineAbilityFor } from "../security/abilities.js";
import { config } from "../config/index.js";

export const AUTH_COOKIE_NAME = "woreda_token";

export const ANONYMOUS = Object.freeze({
  userId: "",
  role: "",
  name: "",
  departmentId: "",
  serviceIds: Object.freeze([]),
  tokenId: "",
  authenticated: false,
});

/**
 * Extracts a named cookie value from raw Cookie header string.
 */
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
 * Extracts raw JWT token string from request Authorization header or cookies.
 */
export function extractToken(req) {
  const header = req.get?.("Authorization") || req.headers?.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  return req.cookies?.[AUTH_COOKIE_NAME] || readCookie(req.headers?.cookie, AUTH_COOKIE_NAME) || "";
}

/**
 * Creates a JWT verification middleware.
 *
 * @param {Object} [options]
 * @param {string} [options.secret] - JWT secret (defaults to config.jwtSecret)
 * @param {Function} [options.isRevoked] - Async function (jti) => Promise<boolean>
 * @param {boolean} [options.optional=true] - If false, throws 401 Unauthorized when token is missing/invalid/revoked
 * @returns {import("express").RequestHandler}
 */
export function createJwtMiddleware({
  secret = config.jwtSecret,
  isRevoked = async () => false,
  optional = true,
} = {}) {
  return async (req, _res, next) => {
    req.caller = ANONYMOUS;
    const raw = extractToken(req);

    if (!raw) {
      if (!optional) {
        return next(new UnauthorizedError("Missing bearer token."));
      }
      const ability = defineAbilityFor(req.caller);
      req.ability = ability;
      req.caller = { ...req.caller, ability };
      req.user = req.caller;
      return next();
    }

    const claims = verifyJwtClaims(secret, raw);
    if (!claims?.sub) {
      if (!optional) {
        return next(new UnauthorizedError("Invalid bearer token."));
      }
      const ability = defineAbilityFor(req.caller);
      req.ability = ability;
      req.caller = { ...req.caller, ability };
      req.user = req.caller;
      return next();
    }

    const revoked = await isRevoked(claims.jti);
    if (revoked) {
      if (!optional) {
        return next(new UnauthorizedError("Token has been revoked."));
      }
      const ability = defineAbilityFor(req.caller);
      req.ability = ability;
      req.caller = { ...req.caller, ability };
      req.user = req.caller;
      return next();
    }

    req.caller = {
      userId: claims.sub,
      role: claims.role || "",
      name: claims.name || "",
      departmentId: claims.dept || "",
      serviceIds: claims.srvs ? claims.srvs.split(",").filter(Boolean) : [],
      tokenId: claims.jti || "",
      authenticated: true,
    };
    req.token = raw;
    const ability = defineAbilityFor(req.caller);
    req.ability = ability;
    req.caller = { ...req.caller, ability };
    req.user = req.caller;

    next();
  };
}

/**
 * Permissive authentication middleware for the global app pipeline:
 * Populates req.caller and req.ability if a valid token is present;
 * continues anonymously if no token is sent.
 */
export function authenticate(secret = config.jwtSecret, isRevoked = async () => false) {
  return createJwtMiddleware({ secret, isRevoked, optional: true });
}

/**
 * Route-level middleware to strictly verify a JWT token.
 * Rejects requests without a valid, unrevoked JWT with 401 Unauthorized.
 */
export function verifyJwtToken(req, res, next) {
  if (req.caller?.authenticated) return next();
  return createJwtMiddleware({ optional: false })(req, res, next);
}
