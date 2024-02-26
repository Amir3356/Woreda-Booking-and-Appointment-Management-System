// Path handling shared by the routers, mirroring Go's http.ServeMux.
import path from "node:path";

/** Go's cleanPath: resolves "." / ".." and duplicate slashes, keeping a trailing slash. */
export function cleanPath(p) {
  if (!p) return "/";
  if (!p.startsWith("/")) p = `/${p}`;
  let np = path.posix.normalize(p);
  if (p.endsWith("/") && np !== "/" && !np.endsWith("/")) np += "/";
  return np;
}

/** True when p is prefix itself or below it ("/api/v1/auth" matches "/api/v1/auth" and "/api/v1/auth/..."). */
export const underPrefix = (p, prefix) => p === prefix || p.startsWith(`${prefix}/`);
