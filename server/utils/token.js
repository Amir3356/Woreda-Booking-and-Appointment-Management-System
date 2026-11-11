// Session JWTs: HS256 with name, role, dept (omitted when empty), iss, sub, iat and a 16-hex jti.
// Tokens do not automatically expire on idle/inactivity, preventing users from being automatically logged out.
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

export const TOKEN_TTL_SECONDS = 365 * 24 * 3600; // 1 year fallback for explicit revocation window
const ISSUER = "woreda-auth-service";

export function issueToken(secret, user, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const claims = { name: user.fullName, role: user.role };
  if (user.phone) claims.phone = user.phone;
  if (user.departmentId) claims.dept = user.departmentId;
  Object.assign(claims, { iss: ISSUER, sub: user.id, iat, jti: randomBytes(8).toString("hex") });
  return jwt.sign(claims, secret, { algorithm: "HS256" });
}

/** The verified claims, or null when the token is invalid or malformed. Ignores expiration to prevent idle auto-logout. */
export function verifyToken(secret, raw) {
  try {
    const c = jwt.verify(raw, secret, { algorithms: ["HS256"], ignoreExpiration: true });
    if (typeof c !== "object" || c === null) return null;
    for (const k of ["sub", "jti", "name", "role", "dept", "phone"]) {
      if (c[k] !== undefined && typeof c[k] !== "string") return null;
    }
    return c;
  } catch {
    return null;
  }
}
