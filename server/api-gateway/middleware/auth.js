// JWT check and identity headers. Services trust X-User-*, so client-supplied values are always removed.
import jwt from "jsonwebtoken";
import { cleanPath } from "../utils/paths.js";
import { writeError } from "../utils/response.js";

const COOKIE_NAME = "woreda_token";
const IDENTITY_HEADERS = ["x-user-id", "x-user-role", "x-user-name", "x-user-department"];

// API.md endpoints marked "Public" (or "Public / Authenticated"). On these a token is optional;
// if present and valid, identity is still forwarded. A GET route also matches HEAD (as in Go).
const PUBLIC_ROUTES = [
  ["GET", "/healthz"],
  ["POST", "/api/v1/auth/register"],
  ["POST", "/api/v1/auth/login"],
  ["GET", "/api/v1/departments"],
  ["GET", "/api/v1/services"],
  ["GET", "/api/v1/schedules/availability"],
  ["POST", "/api/v1/appointments"],
  ["GET", "/api/v1/appointments/track"],
  ["GET", /^\/api\/v1\/appointments\/[^/]+\/slip$/],
  ["GET", "/api/v1/ws"], // live notices for open pages (no personal data)
];

export function isPublic(method, rawPath) {
  const p = cleanPath(rawPath);
  return PUBLIC_ROUTES.some(([m, pattern]) =>
    (method === m || (m === "GET" && method === "HEAD"))
    && (typeof pattern === "string" ? p === pattern : pattern.test(p)));
}

/** Value of the first cookie called name (surrounding quotes removed, as Go does), or "". */
export function readCookie(header, name) {
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0 || part.slice(0, i).trim() !== name) continue;
    let v = part.slice(i + 1).trim();
    if (v.length > 1 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    return v;
  }
  return "";
}

/** The verified claims of the bearer token (or woreda_token cookie); throws when missing or invalid. */
export function parseBearer(req, secret) {
  const header = req.headers.authorization || "";
  let raw = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!raw) {
    raw = readCookie(req.headers.cookie, COOKIE_NAME);
    if (!raw) throw new Error("missing bearer token");
  }
  const claims = jwt.verify(raw, secret, { algorithms: ["HS256"] });
  if (typeof claims !== "object" || claims === null) throw new Error("invalid claims");
  // Go decoded these into string fields: any other type made the token invalid.
  for (const k of ["sub", "jti", "name", "role", "dept"]) {
    if (claims[k] !== undefined && typeof claims[k] !== "string") throw new Error(`invalid claim ${k}`);
  }
  return claims;
}

/** Removes the bearer token and the woreda_token cookie, keeping other cookies. */
function stripCredentials(req) {
  delete req.headers.authorization;
  const kept = (req.headers.cookie || "").split(";").map((s) => s.trim())
    .filter((c) => c.includes("=") && c.slice(0, c.indexOf("=")).trim() !== COOKIE_NAME);
  if (kept.length > 0) req.headers.cookie = kept.join("; ");
  else delete req.headers.cookie;
}

/** Verifies the JWT and forwards identity headers; 401 on protected routes without a valid token. */
export function auth(secret, tokenService) {
  return async (req, res, next) => {
    for (const h of IDENTITY_HEADERS) delete req.headers[h];
    const pub = isPublic(req.method, req.path);
    let claims = null;
    try {
      claims = parseBearer(req, secret);
    } catch {
      claims = null;
    }
    if (claims && await tokenService.isRevoked(claims.jti)) {
      claims = null;
      // Services re-verify the JWT themselves, so drop it before a public route is proxied.
      stripCredentials(req);
    }
    if (!claims && !pub) return writeError(req, res, 401, "UNAUTHORIZED", "Missing or expired bearer token.");
    if (claims) {
      req.headers["x-user-id"] = claims.sub ?? "";
      req.headers["x-user-role"] = claims.role ?? "";
      req.headers["x-user-name"] = claims.name ?? "";
      req.headers["x-user-department"] = claims.dept ?? "";
    }
    next();
  };
}
