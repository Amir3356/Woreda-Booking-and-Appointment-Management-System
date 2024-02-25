// The API.md response envelope and the Express pieces every service uses.
import express from "express";
import { AppError, BadRequestError, NotFoundError } from "./errors.js";

/** RFC 3339 without milliseconds, as the Go services wrote it. */
export const timestamp = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export function ok(res, status, message, data) {
  res.status(status).json({ success: true, message, data: data ?? null, meta: { timestamp: timestamp(), version: "v1" } });
}

export function fail(res, req, status, code, message, details = []) {
  res.status(status).json({
    success: false,
    message,
    error: { code, details },
    meta: { timestamp: timestamp(), requestId: req.get("X-Request-ID") || "" },
  });
}

/** Parses JSON bodies (max 1 MiB); a malformed body becomes 400 BAD_REQUEST. */
export const jsonBody = () => express.json({ limit: "1mb" });

/** The request body as an object, or 400 when it is missing (the Go decoder rejected empty bodies). */
export function body(req) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new BadRequestError("malformed JSON body: expected a JSON object");
  }
  return req.body;
}

/** ?key=true|false -> boolean, anything else -> undefined (no filter). */
export function boolQuery(req, key) {
  const v = String(req.query[key] ?? "").toLowerCase();
  if (["true", "1", "t"].includes(v)) return true;
  if (["false", "0", "f"].includes(v)) return false;
  return undefined;
}

export function notFoundRoute(req, res) {
  fail(res, req, 404, "NOT_FOUND", "Route not found.");
}

/** Final error middleware: AppError -> its envelope; anything else -> 500 (logged). */
export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, next) => {
    if (err?.type === "entity.parse.failed") {
      err = new BadRequestError(`malformed JSON body: ${err.message}`);
    } else if (err?.type === "entity.too.large") {
      err = new BadRequestError("request body is larger than 1 MiB");
    }
    if (err instanceof AppError) {
      if (err.status >= 500) logger.warn({ path: req.path, err: err.cause?.message ?? err.message }, "dependency unavailable");
      return fail(res, req, err.status, err.code, err.message, err.details);
    }
    logger.error({ path: req.path, err: err?.stack ?? String(err) }, "unhandled error");
    return fail(res, req, 500, "INTERNAL_ERROR", "Unhandled server exception.");
  };
}

export { NotFoundError };
