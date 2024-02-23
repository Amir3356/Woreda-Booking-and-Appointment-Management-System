// Thin fetch wrapper for the WoredaCare REST API (see API.md).
// Every module in this folder goes through `request`, so auth headers,
// the response envelope and error handling live in one place.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1";
const COOKIE_NAME = "woreda_token";

export const tokenStorage = {
  get: () => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp("(^|;\\s*)(" + COOKIE_NAME + ")=([^;]*)"));
    return match ? decodeURIComponent(match[3]) : null;
  },
  set: (token, maxAgeDays = 7) => {
    if (typeof document === "undefined" || !token) return;
    const maxAge = maxAgeDays * 24 * 60 * 60;
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  },
  clear: () => {
    if (typeof document === "undefined") return;
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  },
};

/** Error thrown for any non-2xx response, carrying the API's error envelope. */
export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details || [];
  }
}

function buildUrl(path, params) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  return url.toString();
}

/**
 * Sends a request and unwraps the success envelope.
 * Resolves to `{ data, meta, message }`; rejects with `ApiError`.
 */
export async function request(method, path, { body, params, raw = false } = {}) {
  const headers = { Accept: "application/json" };
  const token = tokenStorage.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(buildUrl(path, params), {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (raw && response.ok) return response;

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.message || response.statusText || "Request failed", {
      status: response.status,
      code: payload?.error?.code,
      details: payload?.error?.details,
    });
  }

  return { data: payload?.data, meta: payload?.meta, message: payload?.message };
}

export const http = {
  get: (path, params) => request("GET", path, { params }),
  post: (path, body) => request("POST", path, { body }),
  put: (path, body) => request("PUT", path, { body }),
  patch: (path, body) => request("PATCH", path, { body }),
  delete: (path) => request("DELETE", path),
};
