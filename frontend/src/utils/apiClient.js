/**
 * apiClient.js
 *
 * Security rules enforced here:
 *  - Access token lives in memory ONLY — never localStorage/sessionStorage.
 *  - Refresh token is an HttpOnly cookie set by the backend — JS cannot touch it.
 *  - On 401, silently refresh once then retry. If refresh also fails → redirect to /signin.
 */

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:5000";

// ── In-memory token (cleared on tab close) ────────────────────────────────────
let _accessToken = null;
export const setAccessToken   = (t) => { _accessToken = t; };
export const getAccessToken   = ()  => _accessToken;
export const clearAccessToken = ()  => { _accessToken = null; };

// ── Silent refresh (deduplicated) ─────────────────────────────────────────────
let _refreshing = null;

export async function silentRefresh() {
  if (_refreshing) return _refreshing;
  _refreshing = fetch(`${BASE_URL}/api/auth/refresh`, {
    method:      "POST",
    credentials: "include",  // sends the HttpOnly cookie automatically
  })
    .then(async (res) => {
      if (!res.ok) throw new Error("refresh_failed");
      const { accessToken } = await res.json();
      setAccessToken(accessToken);
      return accessToken;
    })
    .finally(() => { _refreshing = null; });
  return _refreshing;
}

// ── Core request ──────────────────────────────────────────────────────────────
export async function apiRequest(path, options = {}, _retried = false) {
  const headers = { "Content-Type": "application/json", ...(options.headers ?? {}) };
  if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !_retried) {
    try {
      await silentRefresh();
      return apiRequest(path, options, true);
    } catch {
      clearAccessToken();
      window.location.href = "/signin";
      return;
    }
  }
  return res;
}

// ── Convenience wrappers ──────────────────────────────────────────────────────
export const api = {
  get:    (path)       => apiRequest(path, { method: "GET" }),
  post:   (path, body) => apiRequest(path, { method: "POST",  body: JSON.stringify(body) }),
  put:    (path, body) => apiRequest(path, { method: "PUT",   body: JSON.stringify(body) }),
  delete: (path)       => apiRequest(path, { method: "DELETE" }),
};
