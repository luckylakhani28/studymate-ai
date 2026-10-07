import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  withCredentials: true,
  timeout: 20_000,
});

// The access token lives in memory only (never localStorage), so XSS can't read it from storage.
let accessToken = null;
let onSessionExpired = () => {};
let refreshPromise = null;

export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;
export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestRefresh() {
  try {
    return await api.post('/auth/refresh');
  } catch (err) {
    // Another tab rotated the cookie a moment ago; the browser now holds the new one.
    if (err.response?.data?.error?.code === 'REFRESH_RACE') {
      await wait(250);
      return api.post('/auth/refresh');
    }
    throw err;
  }
}

/**
 * Single-flight: concurrent callers (parallel 401s, React StrictMode's double effect)
 * share ONE refresh request, so we never present the same refresh token twice.
 */
export function refreshSession() {
  refreshPromise ??= requestRefresh()
    .then((res) => {
      setAccessToken(res.data.data.accessToken);
      return res.data.data.user;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

const NO_RETRY_PATHS = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']);
const REFRESHABLE_CODES = new Set(['TOKEN_EXPIRED', 'INVALID_TOKEN', 'UNAUTHORIZED']);

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    const shouldRefresh =
      response?.status === 401 &&
      config &&
      !config._retried &&
      !NO_RETRY_PATHS.has(config.url) &&
      REFRESHABLE_CODES.has(response.data?.error?.code);

    if (!shouldRefresh) return Promise.reject(error);

    config._retried = true;
    try {
      await refreshSession();
    } catch {
      setAccessToken(null);
      onSessionExpired();
      return Promise.reject(error);
    }
    return api(config); // replay the original request with the new token
  },
);
