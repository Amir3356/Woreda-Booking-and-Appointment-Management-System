// CSRF protection for cookie-based authentication.
// Storing JWT in an HTTP-only cookie mitigates XSS theft of the token, but because the browser
// automatically attaches cookies to cross-origin requests, state-changing endpoints (POST/PUT/PATCH/DELETE)
// must be protected against Cross-Site Request Forgery (CSRF).
//
// Defense strategy:
// 1. Origin / Referer verification against allowed origins.
// 2. Double-Submit Cookie pattern: a random CSRF token is issued in a readable cookie ("woreda_csrf")
//    and client-side requests must provide matching token in the "X-CSRF-Token" header.
import { randomBytes } from "node:crypto";
import { ForbiddenError } from "../utils/errors.js";

export const CSRF_COOKIE_NAME = "woreda_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

export function generateCsrfToken() {
  return randomBytes(32).toString("hex");
}

export function setCsrfCookie(res, token = generateCsrfToken(), isProduction = false) {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Must be readable by client JavaScript to mirror in X-CSRF-Token header
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 3600 * 1000,
  });
  res.setHeader("X-CSRF-Token", token);
  return token;
}

export function clearCsrfCookie(res, isProduction = false) {
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  });
}

export function csrfProtection({ allowedOrigins = [], isProduction = false, authCookieName = "woreda_token" } = {}) {
  return (req, res, next) => {
    const method = req.method.toUpperCase();

    // Safe read-only methods (GET, HEAD, OPTIONS): ensure CSRF cookie is present
    if (["GET", "HEAD", "OPTIONS"].includes(method)) {
      if (!req.cookies?.[CSRF_COOKIE_NAME]) {
        setCsrfCookie(res, generateCsrfToken(), isProduction);
      }
      return next();
    }

    // Origin verification for state-changing requests
    const origin = req.get("Origin");
    if (origin && allowedOrigins.length > 0) {
      if (!allowedOrigins.includes(origin)) {
        return next(new ForbiddenError("CSRF protection: request origin not permitted."));
      }
    }

    // If request uses cookie authentication, verify matching CSRF token header
    const hasAuthCookie = Boolean(req.cookies?.[authCookieName]);
    const isAuthRoute =
      req.path === "/auth/login" ||
      req.path === "/auth/register" ||
      req.path === "/auth/logout" ||
      req.path.endsWith("/auth/login") ||
      req.path.endsWith("/auth/register") ||
      req.path.endsWith("/auth/logout");

    if (hasAuthCookie && !isAuthRoute) {
      const clientToken = req.get(CSRF_HEADER_NAME) || req.get("x-xsrf-token");
      const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

      if (!clientToken || !cookieToken || clientToken !== cookieToken) {
        return next(new ForbiddenError("CSRF validation failed: missing or invalid CSRF token."));
      }
    }

    next();
  };
}

