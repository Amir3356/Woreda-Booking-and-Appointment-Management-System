// Response caching for frequently requested public data (port of the Go gateway's cache.go).
//
// Only the GET routes in CACHED_ROUTES are cached, and only when the upstream answers 200 with
// JSON. Their handlers do not depend on who is calling, so one cached copy can be served to
// everyone. Each cached entry belongs to a group; any successful write (POST, PUT, PATCH, DELETE)
// to a path in INVALIDATED_BY drops every entry of the affected groups, so users see changes
// immediately. The TTL only bounds staleness from writes that bypass the gateway.
import { timestamp } from "../utils/response.js";
import { underPrefix } from "../utils/paths.js";
import { KEY_PREFIX } from "../repositories/cache.repository.js";

export const GROUP_CATALOG = "catalog"; // departments and services lists
export const GROUP_AVAILABILITY = "availability"; // per-service, per-date slot availability

const CACHED_ROUTES = [
  { path: "/api/v1/departments", group: GROUP_CATALOG, ttl: 600 },
  { path: "/api/v1/services", group: GROUP_CATALOG, ttl: 600 },
  { path: "/api/v1/schedules/availability", group: GROUP_AVAILABILITY, ttl: 30 },
];

// Write path prefix -> cache groups it makes stale.
const INVALIDATED_BY = [
  { prefix: "/api/v1/departments", groups: [GROUP_CATALOG] },
  { prefix: "/api/v1/services", groups: [GROUP_CATALOG] },
  { prefix: "/api/v1/appointments", groups: [GROUP_AVAILABILITY] }, // book, cancel, reschedule, status
  { prefix: "/api/v1/queue", groups: [GROUP_AVAILABILITY] }, // check-in / finalize change appointment state
  { prefix: "/api/v1/schedules", groups: [GROUP_AVAILABILITY] }, // opening hours
  { prefix: "/api/v1/admin/settings", groups: [GROUP_AVAILABILITY] }, // max parallel slots
];

export function matchCachedRoute(path) {
  const p = path.endsWith("/") ? path.slice(0, -1) : path;
  return CACHED_ROUTES.find((r) => r.path === p) ?? null;
}

// Go's url.QueryEscape: only A-Z a-z 0-9 - _ . ~ stay as they are, space becomes "+".
const queryEscape = (s) => encodeURIComponent(s)
  .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  .replace(/%20/g, "+");

/** Go's url.Values.Encode() of url.ParseQuery(rawQuery): keys sorted, values in request order. */
export function canonicalQuery(rawQuery) {
  const values = new Map();
  for (const pair of (rawQuery || "").split("&")) {
    if (!pair || pair.includes(";")) continue;
    const i = pair.indexOf("=");
    const [k, v] = i < 0 ? [pair, ""] : [pair.slice(0, i), pair.slice(i + 1)];
    let key, value;
    try {
      key = decodeURIComponent(k.replace(/\+/g, " "));
      value = decodeURIComponent(v.replace(/\+/g, " "));
    } catch {
      continue; // invalid escape: Go skips the pair
    }
    if (!values.has(key)) values.set(key, []);
    values.get(key).push(value);
  }
  return [...values.keys()].sort()
    .flatMap((k) => values.get(k).map((v) => `${queryEscape(k)}=${queryEscape(v)}`))
    .join("&");
}

/** cache:<group>:<path>?<query with keys sorted>, so ?a=1&b=2 and ?b=2&a=1 share an entry. */
export function cacheKey(route, rawQuery) {
  return `${KEY_PREFIX}${route.group}:${route.path}?${canonicalQuery(rawQuery)}`;
}

/** Replaces meta with this request's id and time, so a cached response is not attributed to the request that filled it. */
export function refreshMeta(body, requestId) {
  let env;
  try {
    env = JSON.parse(body);
  } catch {
    return body;
  }
  if (env === null || typeof env !== "object" || Array.isArray(env) || !("meta" in env)) return body;
  env.meta = { requestId, timestamp: timestamp() };
  return JSON.stringify(env);
}

const isValidJson = (s) => {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
};

export function createCacheService({ cacheRepository, logger }) {
  const service = {
    /** False without Redis: nothing is cached or invalidated. */
    enabled: cacheRepository.enabled,

    matchCachedRoute,
    cacheKey,

    /** The cached response ({ct, body} with meta refreshed for requestId), or null on a miss or a Redis failure. */
    async lookup(key, requestId) {
      try {
        const raw = await cacheRepository.get(key);
        if (raw != null) {
          const entry = JSON.parse(raw);
          if (entry && typeof entry.ct === "string" && entry.body !== undefined) {
            return { ct: entry.ct, body: refreshMeta(JSON.stringify(entry.body), requestId) };
          }
        }
      } catch (err) {
        if (!(err instanceof SyntaxError)) logger.warn({ key, err: err.message }, "cache read failed, serving from upstream");
      }
      return null;
    },

    /** Stores an upstream response when it is a 200 with a valid JSON body. */
    async store(route, key, status, contentType, buf) {
      const ct = String(contentType ?? "");
      const text = buf.toString("utf8");
      if (status !== 200 || !ct.startsWith("application/json") || !isValidJson(text)) return;
      // {"ct":..., "body":<the JSON itself>} as the Go gateway stored it.
      const entry = `{"ct":${JSON.stringify(ct)},"body":${JSON.stringify(JSON.parse(text))}}`;
      try {
        await cacheRepository.set(key, route.group, entry, route.ttl);
      } catch (err) {
        logger.warn({ key, err: err.message }, "cache write failed");
      }
    },

    /** Deletes every cached entry of group; throws when Redis fails. Also used by the Kafka event handlers. */
    invalidateGroup(group) {
      return cacheRepository.deleteGroup(group);
    },

    /** After a successful write to path: drops the groups it makes stale (failures only logged). */
    async invalidateForWrite(path) {
      for (const inv of INVALIDATED_BY) {
        if (!underPrefix(path, inv.prefix)) continue;
        for (const g of inv.groups) {
          try {
            await service.invalidateGroup(g);
          } catch (err) {
            logger.warn({ group: g, err: err.message }, "cache invalidation failed; entries expire on their TTL");
          }
        }
      }
    },
  };
  return service;
}
