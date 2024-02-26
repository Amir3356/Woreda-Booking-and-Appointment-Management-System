// Optional Redis connection (REDIS_URL) for short-lived auth state. Commands fail fast while Redis
// is down (no offline queue), so callers can fail open.
import Redis from "ioredis";
import { logger } from "./logger.js";

/** Connects to url; returns { redis, close }. */
export async function connectRedis(url) {
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
  return { redis, close };
}
