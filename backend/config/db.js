// Central place for the backend API base URL.
// Deployment: set VITE_API_BASE_URL in your .env / hosting provider's env vars.
// Local dev: falls back to the Express server on localhost:5000 if unset.
import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// The refresh-token is an HttpOnly cookie (never touched by JS) — it still
// has to be sent with requests for POST /auth/refresh to work.
axios.defaults.withCredentials = true;

let refreshPromise = null;

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        localStorage.setItem("sentinel_token", res.data.token);
        return res.data.token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// Access tokens are short-lived (15m) by design — this transparently
// refreshes an expired one (once) and retries the original request, so the
// per-file `Authorization: Bearer <token>` calls elsewhere don't need to
// change at all.
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const url = original?.url || "";
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/refresh");

    if (error.response?.status === 401 && !original._retry && !isAuthEndpoint && localStorage.getItem("sentinel_token")) {
      original._retry = true;
      try {
        const newToken = await refreshAccessToken();
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return axios(original);
      } catch {
        localStorage.removeItem("sentinel_token");
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);
