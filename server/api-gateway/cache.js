// Response caching for frequently requested public data (port of the Go gateway's cache.go).
//
// Only the GET routes in CACHED_ROUTES are cached, and only when the upstream answers 200 with
// JSON. Their handlers do not depend on who is calling, so one cached copy can be served to
// everyone. Each cached entry belongs to a group; any successful write (POST, PUT, PATCH, DELETE)
// to a path in INVALIDATED_BY drops every entry of the affected groups, so users see changes
// immediately. The TTL only bounds staleness from writes that bypass the gateway.
import { timestamp } from "./lib/index.js";
import { underPrefix } from "./paths.js";
import { withTimeout } from "./middleware.js";

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

const KEY_PREFIX = "cache:";
const groupSetKey = (group) => `${KEY_PREFIX}group:${group}`;

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

/** Deletes every cached entry of group. Also called by the Kafka consumers. */
export async function invalidateGroup(redis, group) {
  const setKey = groupSetKey(group);
  const work = (async () => {
    const keys = await redis.smembers(setKey);
    await redis.del(...keys, setKey);
  })();
  await withTimeout(work, 500, "cache invalidation");
}

async function invalidate(redis, path, logger) {
  for (const inv of INVALIDATED_BY) {
    if (!underPrefix(path, inv.prefix)) continue;
    for (const g of inv.groups) {
      try {
        await invalidateGroup(redis, g);
      } catch (err) {
        logger.warn({ group: g, err: err.message }, "cache invalidation failed; entries expire on their TTL");
      }
    }
  }
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

/**
 * Calls fn(statusCode, bodyBuffer) once the downstream handler ends the response, and only then
 * lets the response finish, so a cache write/invalidation is done before the client sees the end
 * (as in Go, where it ran before the handler returned). With capture=false the body is not kept.
 */
function beforeEnd(res, capture, fn) {
  const chunks = [];
  const keep = (chunk, encoding) => {
    if (!capture || chunk == null || typeof chunk === "function") return;
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === "string" ? encoding : "utf8"));
  };
  const write = res.write;
  const end = res.end;
  res.write = function (chunk, encoding, cb) {
    keep(chunk, encoding);
    return write.call(this, chunk, encoding, cb);
  };
  res.end = function (chunk, encoding, cb) {
    keep(chunk, encoding);
    res.end = end;
    Promise.resolve()
      .then(() => fn(res.statusCode, capture ? Buffer.concat(chunks) : null))
      .catch(() => {})
      .finally(() => end.call(this, chunk, encoding, cb));
    return this;
  };
}

/** Serves CACHED_ROUTES from Redis and invalidates them on writes. Without redis it is a no-op. */
export function cache(redis, logger) {
  if (!redis) return (_req, _res, next) => next();
  return async (req, res, next) => {
    if (req.method === "HEAD" || req.method === "OPTIONS") return next();
    if (req.method !== "GET") {
      beforeEnd(res, false, async (status) => {
        if (status >= 200 && status < 300) await invalidate(redis, req.path, logger);
      });
      return next();
    }
    const route = matchCachedRoute(req.path);
    if (!route) return next();

    const qi = req.url.indexOf("?");
    const key = cacheKey(route, qi < 0 ? "" : req.url.slice(qi + 1));
    try {
      const raw = await withTimeout(redis.get(key), 200, "redis GET");
      if (raw != null) {
        const entry = JSON.parse(raw);
        if (entry && typeof entry.ct === "string" && entry.body !== undefined) {
          res.statusCode = 200;
          res.setHeader("Content-Type", entry.ct);
          res.setHeader("X-Cache", "HIT");
          return res.end(refreshMeta(JSON.stringify(entry.body), req.headers["x-request-id"] || ""));
        }
      }
    } catch (err) {
      if (!(err instanceof SyntaxError)) logger.warn({ key, err: err.message }, "cache read failed, serving from upstream");
    }

    // Miss: let the upstream answer, keeping a copy of the body so it can be stored.
    res.setHeader("X-Cache", "MISS");
    beforeEnd(res, true, async (status, buf) => {
      const ct = String(res.getHeader("Content-Type") ?? "");
      const text = buf.toString("utf8");
      if (status !== 200 || !ct.startsWith("application/json") || !isValidJson(text)) return;
      // {"ct":..., "body":<the JSON itself>} as the Go gateway stored it.
      const entry = `{"ct":${JSON.stringify(ct)},"body":${JSON.stringify(JSON.parse(text))}}`;
      const setKey = groupSetKey(route.group);
      try {
        await withTimeout(
          redis.multi().set(key, entry, "EX", route.ttl).sadd(setKey, key).expire(setKey, route.ttl).exec(),
          200, "redis cache write",
        );
      } catch (err) {
        logger.warn({ key, err: err.message }, "cache write failed");
      }
    });
    next();
  };
}
