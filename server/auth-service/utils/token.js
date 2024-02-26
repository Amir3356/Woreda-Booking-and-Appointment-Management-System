// Session JWTs (Go service/token.go).
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

export const TOKEN_TTL_SECONDS = 12 * 3600;
export const ISSUER = "woreda-auth-service";

/** HS256 JWT with name, role, dept (omitted when empty), iss, sub, iat, exp (+12h) and a 16-hex jti. */
export function issueToken(secret, user, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const claims = { name: user.fullName, role: user.role };
  if (user.departmentId) claims.dept = user.departmentId;
  Object.assign(claims, {
    iss: ISSUER, sub: user.id, exp: iat + TOKEN_TTL_SECONDS, iat, jti: randomBytes(8).toString("hex"),
  });
  return jwt.sign(claims, secret, { algorithm: "HS256" }); // keeps the iat given in claims
}
