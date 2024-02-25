// Cross-cutting middleware (outermost first): request id -> request log -> CORS -> auth -> cache.
import { randomBytes } from "node:crypto";
import { timestamp } from "./lib/index.js";

export const REQUEST_ID_HEADER = "X-Request-ID";

/** Ensures every request has an X-Request-ID (forwarded upstream) and echoes it on the response. */
export function requestId(req, res, next) {
  let id = req.headers["x-request-id"];
  if (!id) {
    id = `req-${randomBytes(6).toString("hex")}`;
    req.headers["x-request-id"] = id;
  }
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}

/** Sets the CORS response headers for an allowed Origin (shared by HTTP and the WebSocket upgrade). */
export function corsHeaders(allowed, origin) {
  const headers = {};
  if (origin && (allowed.includes("*") || allowed.includes(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Vary"] = "Origin";
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Request-ID, Cookie";
    headers["Access-Control-Max-Age"] = "600";
  }
  headers["X-Content-Type-Options"] = "nosniff";
  return headers;
}

/** Allows configured origins; every OPTIONS request is answered here with 204. */
export function cors(allowed) {
  return (req, res, next) => {
    for (const [k, v] of Object.entries(corsHeaders(allowed, req.headers.origin))) res.setHeader(k, v);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }
    next();
  };
}

/** The API.md error envelope, byte-compatible with the Go gateway's WriteError (sorted keys, trailing newline). */
export function writeError(req, res, status, code, message) {
  const body = {
    error: { code, details: [] },
    message,
    meta: { requestId: req.headers["x-request-id"] || "", timestamp: timestamp() },
    success: false,
  };
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(`${JSON.stringify(body)}\n`);
}

/** Go's http.Error: plain text body with a trailing newline. */
export function writeText(res, status, text, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(`${text}\n`);
}

/** Rejects when promise does not settle within ms (its later result is ignored). */
export function withTimeout(promise, ms, what = "operation") {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
