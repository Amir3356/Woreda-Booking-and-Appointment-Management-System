// /api/v1/auth (API.md module 1).
import { Router, body, ok, requireRole } from "./lib/index.js";

export const AUTH_COOKIE_NAME = "woreda_token";
const COOKIE_MAX_AGE = 7 * 24 * 3600;

/** The Set-Cookie value Go's http.SetCookie wrote: Path=/, Max-Age, SameSite=Lax, not HttpOnly, not Secure.
 *  A negative maxAge deletes the cookie (Max-Age=0). */
export function tokenCookie(token, maxAge) {
  return `${AUTH_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge > 0 ? maxAge : 0}; SameSite=Lax`;
}

export function authRoutes(auth) {
  const r = Router();
  const signedIn = requireRole("CITIZEN", "OFFICER", "ADMIN");

  r.post("/api/v1/auth/register", async (req, res) => {
    const result = await auth.register(body(req));
    res.append("Set-Cookie", tokenCookie(result.token, COOKIE_MAX_AGE));
    ok(res, 201, "Citizen account registered successfully.", result);
  });
  r.post("/api/v1/auth/login", async (req, res) => {
    const result = await auth.login(body(req));
    res.append("Set-Cookie", tokenCookie(result.token, COOKIE_MAX_AGE));
    ok(res, 200, "Authentication successful.", result);
  });
  r.get("/api/v1/auth/me", signedIn, async (req, res) => {
    ok(res, 200, "Profile retrieved successfully.", await auth.me(req.caller.userId));
  });
  r.post("/api/v1/auth/logout", signedIn, async (req, res) => {
    await auth.logout(req.caller);
    res.append("Set-Cookie", tokenCookie("", -1));
    ok(res, 200, "Logged out successfully.", null);
  });

  return r;
}
