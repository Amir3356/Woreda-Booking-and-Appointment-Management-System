// Response cache in front of the proxy: serves cached GETs (X-Cache: HIT), records misses
// (X-Cache: MISS) and invalidates on successful writes. The rules live in services/cache.service.js.

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

/** Without Redis (cacheService.enabled false) it is a no-op. */
export function cache(cacheService) {
  if (!cacheService.enabled) return (_req, _res, next) => next();
  return async (req, res, next) => {
    if (req.method === "HEAD" || req.method === "OPTIONS") return next();
    if (req.method !== "GET") {
      beforeEnd(res, false, async (status) => {
        if (status >= 200 && status < 300) await cacheService.invalidateForWrite(req.path);
      });
      return next();
    }
    const route = cacheService.matchCachedRoute(req.path);
    if (!route) return next();

    const qi = req.url.indexOf("?");
    const key = cacheService.cacheKey(route, qi < 0 ? "" : req.url.slice(qi + 1));
    const hit = await cacheService.lookup(key, req.headers["x-request-id"] || "");
    if (hit) {
      res.statusCode = 200;
      res.setHeader("Content-Type", hit.ct);
      res.setHeader("X-Cache", "HIT");
      return res.end(hit.body);
    }

    // Miss: let the upstream answer, keeping a copy of the body so it can be stored.
    res.setHeader("X-Cache", "MISS");
    beforeEnd(res, true, (status, buf) => cacheService.store(route, key, status, res.getHeader("Content-Type"), buf));
    next();
  };
}
