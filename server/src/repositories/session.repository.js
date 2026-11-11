// Short-lived auth state: revoked token ids (logout) and failed sign-in counters (lockout).
import { one, query } from "../config/database.js";

/** Denylists jti until ttlSeconds elapse (the token's remaining lifetime); also drops expired entries. */
export async function revokeToken(jti, ttlSeconds) {
  await query(
    `INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, now() + make_interval(secs => $2))
     ON CONFLICT (jti) DO NOTHING`,
    [jti, ttlSeconds],
  );
  await query("DELETE FROM revoked_tokens WHERE expires_at < now()");
}

export async function isRevoked(jti) {
  return Boolean(await one("SELECT 1 FROM revoked_tokens WHERE jti = $1 AND expires_at > now()", [jti]));
}

/** Failed attempts for email within the current window. */
export async function loginFailures(email) {
  const row = await one("SELECT failures FROM login_failures WHERE email = LOWER($1) AND expires_at > now()", [email]);
  return row?.failures ?? 0;
}

/** Counts one failure; the window restarts with each failure. */
export async function recordLoginFailure(email, windowSeconds) {
  await query(
    `INSERT INTO login_failures (email, failures, expires_at) VALUES (LOWER($1), 1, now() + make_interval(secs => $2))
     ON CONFLICT (email) DO UPDATE SET
       failures = CASE WHEN login_failures.expires_at > now() THEN login_failures.failures + 1 ELSE 1 END,
       expires_at = EXCLUDED.expires_at`,
    [email, windowSeconds],
  );
}

export async function clearLoginFailures(email) {
  await query("DELETE FROM login_failures WHERE email = LOWER($1)", [email]);
}
