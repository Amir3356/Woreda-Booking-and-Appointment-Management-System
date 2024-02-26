// Answers the gateway writes when it cannot route or forward a request.
import { writeError, writeText } from "../utils/response.js";

/** Unknown paths: Go ServeMux's plain-text 404. */
export function notFound(_req, res) {
  writeText(res, 404, "404 page not found");
}

/** Proxy error callback for one upstream: logged, then 502 BAD_GATEWAY in the error envelope. */
export function upstreamError(target, logger) {
  return (err, req, res) => {
    logger.error({ upstream: target, path: req.path ?? req.url, err: err.message }, "upstream error");
    if (typeof res.setHeader !== "function") return res.destroy?.(); // a raw socket
    if (res.headersSent) return res.destroy();
    writeError(req, res, 502, "BAD_GATEWAY", "Upstream service unavailable.");
  };
}
