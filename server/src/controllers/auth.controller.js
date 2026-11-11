// /api/v1/auth: read the request, call the service, set/clear the woreda_token cookie, send the envelope.
import { ok } from "../utils/response.js";
import { AUTH_COOKIE_NAME } from "../middleware/auth.js";

const COOKIE_MAX_AGE = 7 * 24 * 3600;

/** Path=/, Max-Age, SameSite=Lax (readable by the web app). A negative maxAge deletes the cookie. */
export function tokenCookie(token, maxAge) {
  return `${AUTH_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge > 0 ? maxAge : 0}; SameSite=Lax`;
}

export function createAuthController(authService) {
  return {
    async register(req, res) {
      const result = await authService.register(req.body);
      res.append("Set-Cookie", tokenCookie(result.token, COOKIE_MAX_AGE));
      ok(res, 201, "Citizen account registered successfully.", result);
    },
    async login(req, res) {
      const result = await authService.login(req.body);
      res.append("Set-Cookie", tokenCookie(result.token, COOKIE_MAX_AGE));
      ok(res, 200, "Authentication successful.", result);
    },
    async me(req, res) {
      ok(res, 200, "Profile retrieved successfully.", await authService.me(req.caller.userId));
    },
    async logout(req, res) {
      await authService.logout(req.caller);
      res.append("Set-Cookie", tokenCookie("", -1));
      ok(res, 200, "Logged out successfully.", null);
    },
  };
}
