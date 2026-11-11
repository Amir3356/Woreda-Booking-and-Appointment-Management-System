// Thin fetch wrapper for the WoredaCare REST API (see API.md).
// Every module in this folder goes through `request`, so auth headers,
// the response envelope and error handling live in one place.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1";
const COOKIE_NAME = "woreda_token";
const TOKEN_STORAGE_KEY = "woreda_jwt_token";
const CSRF_COOKIE_NAME = "woreda_csrf";
const CSRF_STORAGE_KEY = "woreda_csrf_token";

function getCsrfToken() {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(new RegExp("(^|;\\s*)(" + CSRF_COOKIE_NAME + ")=([^;]*)"));
    if (match) return decodeURIComponent(match[3]);
  }
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(CSRF_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  return null;
}

export const tokenStorage = {
  get: () => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
        if (stored) return stored;
      }
    } catch {
      // ignore
    }
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(new RegExp("(^|;\\s*)(" + COOKIE_NAME + ")=([^;]*)"));
    return match ? decodeURIComponent(match[3]) : null;
  },
  set: (token, maxAgeDays = 365) => {
    if (!token) return;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
    } catch {
      // ignore
    }
    if (typeof document === "undefined") return;
    const maxAge = maxAgeDays * 24 * 60 * 60;
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  },
  clear: () => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        window.localStorage.removeItem(CSRF_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    if (typeof document === "undefined") return;
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    document.cookie = `${CSRF_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
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

  const csrfToken = getCsrfToken();
  if (csrfToken && ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  const response = await fetch(buildUrl(path, params), {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const responseCsrf = response.headers.get("x-csrf-token");
  if (responseCsrf) {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(CSRF_STORAGE_KEY, responseCsrf);
      }
    } catch {
      // ignore
    }
    if (typeof document !== "undefined") {
      document.cookie = `${CSRF_COOKIE_NAME}=${encodeURIComponent(responseCsrf)}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }

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
