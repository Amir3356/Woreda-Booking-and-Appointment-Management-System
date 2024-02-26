// The API.md response envelope and small request helpers used by controllers.
import { BadRequestError } from "./errors.js";

/** RFC 3339 without milliseconds, e.g. "2026-11-03T18:40:26Z". */
export const timestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

/** Success envelope: {success, message, data, meta: {timestamp, version}}. */
export function ok(res, status, message, data) {
  res.status(status).json({ success: true, message, data: data ?? null, meta: { timestamp: timestamp(), version: "v1" } });
}

/** OKWithMeta of the Go controller: 200 with meta {cursor, timestamp} (no "version"). */
export function okWithCursor(res, message, data, cursor) {
  res.status(200).json({ success: true, message, data, meta: { cursor, timestamp: timestamp() } });
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
