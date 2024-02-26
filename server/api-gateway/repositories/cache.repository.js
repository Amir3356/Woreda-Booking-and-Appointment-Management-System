// Cached responses in Redis:
//   cache:<group>:<path>?<query>  -> {"ct":..., "body":...} with the route's TTL
//   cache:group:<group>           -> set of the entry keys of that group (for invalidation)
import { withTimeout } from "../utils/timeout.js";

export const KEY_PREFIX = "cache:";
const groupSetKey = (group) => `${KEY_PREFIX}group:${group}`;

/** redis may be null (REDIS_URL not set). */
export function createCacheRepository(redis) {
  return {
    enabled: Boolean(redis),

    /** The stored entry text, or null on a miss. */
    get(key) {
      return withTimeout(redis.get(key), 200, "redis GET");
    },

    /** Stores the entry with a TTL and records it in its group. */
    async set(key, group, entry, ttl) {
      const setKey = groupSetKey(group);
      await withTimeout(
        redis.multi().set(key, entry, "EX", ttl).sadd(setKey, key).expire(setKey, ttl).exec(),
        200, "redis cache write",
      );
    },

    /** Deletes every entry of group and the group set itself. */
    async deleteGroup(group) {
      const setKey = groupSetKey(group);
      const work = (async () => {
        const keys = await redis.smembers(setKey);
        await redis.del(...keys, setKey);
      })();
      await withTimeout(work, 500, "cache invalidation");
    },
  };
}
