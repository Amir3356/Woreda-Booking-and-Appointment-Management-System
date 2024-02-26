// Revoked JWTs in Redis. auth-service sets REVOKED_TOKEN_KEY_PREFIX + jti on logout (keep the two in sync).
import { withTimeout } from "../utils/timeout.js";

export const REVOKED_TOKEN_KEY_PREFIX = "auth:revoked:";

/** redis may be null (REDIS_URL not set). */
export function createTokenRepository(redis) {
  return {
    enabled: Boolean(redis),
    /** True when the token id is on the revocation list; throws when Redis does not answer in time. */
    async isRevoked(jti) {
      return (await withTimeout(redis.exists(REVOKED_TOKEN_KEY_PREFIX + jti), 200, "redis EXISTS")) > 0;
    },
  };
}
