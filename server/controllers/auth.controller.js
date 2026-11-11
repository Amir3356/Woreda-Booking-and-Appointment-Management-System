// /api/v1/auth: read request, invoke service, manage HTTP-only JWT cookies & CSRF tokens, send envelope.
import { ok } from "../utils/response.js";
import { AUTH_COOKIE_NAME } from "../middleware/jwt.js";
import { setCsrfCookie, clearCsrfCookie, generateCsrfToken, CSRF_COOKIE_NAME } from "../middleware/csrf.js";
import { config } from "../config/index.js";

const COOKIE_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true, // Critical: JavaScript cannot access this cookie, preventing XSS-based token theft
  secure: config.isProduction, // Only send over HTTPS in production
  sameSite: "lax", // SameSite=Lax for cross-site request mitigation
  path: "/",
  maxAge: COOKIE_MAX_AGE_MS,
};

export function createAuthController(authService) {
  return {
    async register(req, res) {
      const result = await authService.register(req.body);
      // 1. Set JWT in HTTP-only cookie
      res.cookie(AUTH_COOKIE_NAME, result.token, AUTH_COOKIE_OPTIONS);
      // 2. Set CSRF cookie (readable by JS for Double-Submit validation)
      const csrfToken = setCsrfCookie(res, generateCsrfToken(), config.isProduction);
      ok(res, 201, "Citizen account registered successfully.", { ...result, csrfToken });
    },

    async login(req, res) {
      const result = await authService.login(req.body);
      // 1. Set JWT in HTTP-only cookie
      res.cookie(AUTH_COOKIE_NAME, result.token, AUTH_COOKIE_OPTIONS);
      // 2. Set CSRF cookie (readable by JS for Double-Submit validation)
      const csrfToken = setCsrfCookie(res, generateCsrfToken(), config.isProduction);
      ok(res, 200, "Authentication successful.", { ...result, csrfToken });
    },

    async me(req, res) {
      ok(res, 200, "Profile retrieved successfully.", await authService.me(req.caller.userId));
    },

    async csrf(req, res) {
      const existingToken = req.cookies?.[CSRF_COOKIE_NAME];
      const token = existingToken || setCsrfCookie(res, generateCsrfToken(), config.isProduction);
      ok(res, 200, "CSRF token initialized successfully.", { csrfToken: token });
    },

    async logout(req, res) {
      await authService.logout(req.caller);
      // Clear HTTP-only auth cookie and CSRF cookie
      res.clearCookie(AUTH_COOKIE_NAME, {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: "lax",
        path: "/",
      });
      clearCsrfCookie(res, config.isProduction);
      ok(res, 200, "Logged out successfully.", null);
    },
  };
}
