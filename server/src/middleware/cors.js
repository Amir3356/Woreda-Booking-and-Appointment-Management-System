// CORS for the configured frontend origins (the WebSocket upgrade uses corsHeaders too).

/** The CORS response headers for an allowed Origin, plus X-Content-Type-Options. */
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
