// The API.md response envelope and small request helpers used by controllers.
import { BadRequestError } from "./errors.js";

/** RFC 3339 without milliseconds, e.g. "2026-11-03T18:40:26Z". */
export const timestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

/** Success envelope: {success, message, data, meta: {timestamp, version}}. */
export function ok(res, status, message, data) {
  res.status(status).json({ success: true, message, data: data ?? null, meta: { timestamp: timestamp(), version: "v1" } });
}

/** Error envelope: {success: false, message, error: {code, details}, meta: {timestamp, requestId}}. */
export function fail(res, req, status, code, message, details = []) {
  res.status(status).json({
    success: false,
    message,
    error: { code, details },
    meta: { timestamp: timestamp(), requestId: req.get("X-Request-ID") || "" },
  });
}

/** The JSON request body as an object, or 400 BAD_REQUEST when it is missing. */
export function body(req) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new BadRequestError("malformed JSON body: expected a JSON object");
  }
  return req.body;
}

/** ?key=true|false -> boolean; anything else -> undefined (no filter). */
export function boolQuery(req, key) {
  const v = String(req.query[key] ?? "").toLowerCase();
  if (["true", "1", "t"].includes(v)) return true;
  if (["false", "0", "f"].includes(v)) return false;
  return undefined;
}
