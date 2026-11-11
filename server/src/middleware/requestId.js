// Ensures every request has an X-Request-ID (used in logs and error envelopes) and echoes it on the response.
import { randomBytes } from "node:crypto";

export const REQUEST_ID_HEADER = "X-Request-ID";

export function requestId(req, res, next) {
  let id = req.headers["x-request-id"];
  if (!id) {
    id = `req-${randomBytes(6).toString("hex")}`;
    req.headers["x-request-id"] = id;
  }
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
