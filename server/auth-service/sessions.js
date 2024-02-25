// Short-lived auth state in Redis: revoked token IDs and failed-login counters.
// RevokedTokenKeyPrefix must match the api-gateway's, which rejects these tokens.
import Redis from "ioredis";

export const REVOKED_TOKEN_KEY_PREFIX = "auth:revoked:";
const LOGIN_FAIL_KEY_PREFIX = "auth:login_fail:";

export const loginFailKey = (email) => LOGIN_FAIL_KEY_PREFIX + email.toLowerCase();

export class SessionStore {
  constructor(redis) {
    this.redis = redis;
  }

  /** Denylists jti until ttlSeconds elapse (the token's remaining lifetime). */
  async revokeToken(jti, ttlSeconds) {
    await this.redis.set(REVOKED_TOKEN_KEY_PREFIX + jti, 1, "EX", ttlSeconds);
  }

  async loginFailures(email) {
    const v = await this.redis.get(loginFailKey(email));
    if (v === null) return 0;
    const n = Number(v);
    if (!Number.isInteger(n)) throw new Error(`login failure counter is not an integer: ${v}`);
    return n;
  }

  /** Increments the counter for email; the window restarts with each failure. */
  async recordLoginFailure(email, windowSeconds) {
    const key = loginFailKey(email);
    const results = await this.redis.multi().incr(key).expire(key, windowSeconds).exec();
    const failed = results?.find(([err]) => err);
    if (failed) throw failed[0];
  }

  async clearLoginFailures(email) {
    await this.redis.del(loginFailKey(email));
  }
}

/** Connects to REDIS_URL. Commands fail fast while Redis is down (no offline queue), so callers can fail open. */
export async function connectSessionStore(url, logger) {
  const redis = new Redis(url, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1 });
  let down = false;
  redis.on("error", (err) => {
    if (!down) logger.warn({ err: err.message }, "redis error");
    down = true;
  });
  redis.on("ready", () => {
    if (down) logger.info("redis reconnected");
    down = false;
  });
  try {
    await redis.connect();
  } catch (err) {
    logger.warn({ err: err.message }, "redis not reachable yet");
  }
  // quit() waits for a connection that may never come back, so only use it while connected.
  const close = async () => {
    if (redis.status !== "ready") return redis.disconnect();
    await Promise.race([redis.quit(), new Promise((r) => setTimeout(r, 2000).unref())]).catch(() => {});
    redis.disconnect();
  };
  return { store: new SessionStore(redis), close };
}
