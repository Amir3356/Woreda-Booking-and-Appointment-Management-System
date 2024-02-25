import Redis from "ioredis";
import { withTimeout } from "./middleware.js";

/**
 * Returns null when url is empty. An unreachable server is only logged: ioredis reconnects on
 * its own and the middlewares fall back while it is down (commands fail fast, no offline queue).
 */
export async function connectRedis(url, logger) {
  if (!url) {
    logger.warn("REDIS_URL not set: response caching is off and logout does not revoke tokens");
    return null;
  }
  const redis = new Redis(url, { enableOfflineQueue: false, maxRetriesPerRequest: 1, connectTimeout: 3000 });
  let down = false;
  redis.on("error", (err) => {
    if (!down) logger.warn({ err: err.message }, "redis unavailable");
    down = true;
  });
  redis.on("ready", () => {
    if (down) logger.info("redis reconnected");
    down = false;
  });
  try {
    await withTimeout(new Promise((resolve) => redis.once("ready", resolve)), 3000, "redis connect");
  } catch (err) {
    logger.warn({ err: err.message }, "redis not reachable yet");
  }
  return redis;
}
