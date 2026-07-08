/**
 * Axios clients for FastAPI (port 8000) and Intervention Engine.
 *
 * Both share the same in-memory access token.
 * Both have a 401 interceptor: refresh once → retry → else logout.
 *
 * In development, requests use relative paths (empty baseURL) and are
 * forwarded to the backends by Vite's dev proxy (see vite.config.js).
 * In production, set VITE_FASTAPI_URL / VITE_INTERVENTION_URL to the
 * actual backend origins.
 */
import axios from 'axios';

// ── In-memory token (NEVER in localStorage/sessionStorage) ──────────────────
let _accessToken = null;

export function getAccessToken() {
  return _accessToken;
}

export function setAccessToken(token) {
  _accessToken = token;
}

export function clearAccessToken() {
  _accessToken = null;
}

// ── FastAPI Client (port 8000) ──────────────────────────────────────────────
// Empty baseURL → relative paths → Vite proxy handles in dev (no CORS)
export const fastApi = axios.create({
  baseURL: import.meta.env.VITE_FASTAPI_URL || '',
  withCredentials: true, // sends httpOnly refresh cookie
});

// ── Intervention Engine Client ──────────────────────────────────────────────
// All intervention calls already proxy through FastAPI, but kept for
// potential future direct access.
export const interventionApi = axios.create({
  baseURL: import.meta.env.VITE_INTERVENTION_URL || '',
  withCredentials: true,
});

// ── Request Interceptor: attach Bearer token ────────────────────────────────
function attachToken(config) {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

fastApi.interceptors.request.use(attachToken);
interventionApi.interceptors.request.use(attachToken);

// ── Response Interceptor: handle 401 → refresh → retry ─────────────────────
let _refreshPromise = null; // deduplicate concurrent refresh calls

async function refreshAccessToken() {
  // Use relative path so it goes through the proxy in dev
  const res = await axios.post(
    '/auth/refresh',
    {},
    { withCredentials: true }
  );
  const newToken = res.data.access_token;
  setAccessToken(newToken);
  return newToken;
}

function createResponseInterceptor(instance) {
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Only attempt refresh on 401 and only once per request
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          // Deduplicate: if a refresh is already in flight, wait for it
          if (!_refreshPromise) {
            _refreshPromise = refreshAccessToken().finally(() => {
              _refreshPromise = null;
            });
          }

          const newToken = await _refreshPromise;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return instance(originalRequest);
        } catch (refreshError) {
          // Refresh failed — clear state, redirect to login
          clearAccessToken();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );
}

createResponseInterceptor(fastApi);
createResponseInterceptor(interventionApi);
