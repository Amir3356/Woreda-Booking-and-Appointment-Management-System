// Responses the gateway writes itself (everything else is the upstream's response, untouched).

/** RFC 3339 without milliseconds, e.g. "2026-11-03T18:40:26Z". */
export const timestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

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
