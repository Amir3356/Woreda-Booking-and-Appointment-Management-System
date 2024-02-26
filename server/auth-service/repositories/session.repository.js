// Short-lived auth state in Redis: revoked token IDs and failed-login counters.
// REVOKED_TOKEN_KEY_PREFIX must match the api-gateway's, which rejects these tokens.
export const REVOKED_TOKEN_KEY_PREFIX = "auth:revoked:";
const LOGIN_FAIL_KEY_PREFIX = "auth:login_fail:";

export const loginFailKey = (email) => LOGIN_FAIL_KEY_PREFIX + email.toLowerCase();

/** Session repository on an ioredis client (see config/redis.js). */
export function createSessionRepository(redis) {
  return {
    /** Denylists jti until ttlSeconds elapse (the token's remaining lifetime). */
    async revokeToken(jti, ttlSeconds) {
      await redis.set(REVOKED_TOKEN_KEY_PREFIX + jti, 1, "EX", ttlSeconds);
    },

    async loginFailures(email) {
      const v = await redis.get(loginFailKey(email));
      if (v === null) return 0;
      const n = Number(v);
      if (!Number.isInteger(n)) throw new Error(`login failure counter is not an integer: ${v}`);
      return n;
    },

    /** Increments the counter for email; the window restarts with each failure. */
    async recordLoginFailure(email, windowSeconds) {
      const key = loginFailKey(email);
      const results = await redis.multi().incr(key).expire(key, windowSeconds).exec();
      const failed = results?.find(([err]) => err);
      if (failed) throw failed[0];
    },

    async clearLoginFailures(email) {
      await redis.del(loginFailKey(email));
    },
  };
}
