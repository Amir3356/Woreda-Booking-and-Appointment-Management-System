// The API response envelope and small request helpers used by controllers.
/** RFC 3339 without milliseconds, e.g. "2026-11-03T18:40:26Z". */
export const timestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

/** Success envelope: {success, message, data, meta: {timestamp, version}}. */
export function ok(res, status, message, data) {
  res.status(status).json({ success: true, message, data: data ?? null, meta: { timestamp: timestamp(), version: "v1" } });
}

/** Paged success envelope: meta holds pagination and timestamp. */
export function okPage(res, message, data, pagination) {
  res.status(200).json({ success: true, message, data, meta: { pagination, timestamp: timestamp() } });
}

/** Cursor-paged success envelope: meta holds cursor and timestamp. */
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
