/**
 * Base API client — handles auth headers, 401 auto-refresh, retry logic,
 * and typed error handling. All API calls go through this.
 */

import { USER_SCOPED_STORAGE_KEYS } from '../constants';

const BASE_URL =process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

let accessToken: string | null = null;
let refreshToken: string | null = null;
// Bumped by clearTokens(): a response to a request sent under an earlier
// session is dropped, so a slow dashboard or coach call cannot repopulate
// the UI (or the caches) after sign-out.
let sessionEpoch = 0;
// Set while a deliberate sign-out navigates away: a stray 401 must not
// redirect to /login and override that navigation.
let signingOut = false;

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  signingOut = false;
  if (typeof window !== 'undefined') {
    localStorage.setItem('cx-refresh', refresh);
  }
}

export function getAccessToken() { return accessToken; }

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  sessionEpoch++;
  cache.clear();
  inFlight.clear();
  if (typeof window !== 'undefined') {
    // the refresh token, cached snapshot, local state and coach cache all
    // belong to this session's user (the server keeps the durable copies)
    for (const key of USER_SCOPED_STORAGE_KEYS) localStorage.removeItem(key);
  }
}

/** Ends the session in this tab: clears credentials and caches, and keeps
 *  late 401s from redirecting while the caller navigates away. */
export function beginSignOut() {
  signingOut = true;
  clearTokens();
}

/** Sends the browser to the sign-in page after the session was refused, unless a sign-out is already navigating. */
function toLogin() {
  if (typeof window !== 'undefined' && !signingOut) {
    window.location.href = '/login';
  }
}

export function loadStoredRefreshToken() {
  if (typeof window !== 'undefined') {
    refreshToken = localStorage.getItem('cx-refresh');
  }
}

// Rehydrate the in-memory refresh token from storage as soon as this module
// loads, not just when some caller remembers to invoke the function above.
// Without this, a hard navigation (e.g. window.location.assign after login)
// wipes module memory, and the first authenticated request on the new page
// finds refreshToken === null — so a 401 can never self-heal via refresh,
// even though a valid refresh token is sitting in localStorage.
loadStoredRefreshToken();

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public errors?: Record<string, string>
  ) {
    super(detail);
    this.name = 'ApiError';
  }
}

/**
 * 'rejected'    — the server refused the refresh token: the session is over.
 * 'unreachable' — network failure or server error: the session may be fine,
 *                 so the caller must not sign the user out.
 */
type RefreshResult = 'ok' | 'rejected' | 'unreachable';

/** The newest refresh token: another tab may have rotated it since this one loaded. */
function latestRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('cx-refresh');
    if (stored) refreshToken = stored;
  }
  return refreshToken;
}

async function exchangeRefreshToken(token: string): Promise<RefreshResult> {
  const epoch = sessionEpoch;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    });
  } catch {
    return 'unreachable';
  }
  if (res.status >= 500) return 'unreachable';
  if (!res.ok) return 'rejected';
  try {
    const data = await res.json();
    // signed out while the refresh was in flight: storing these would revive the session
    if (epoch !== sessionEpoch) return 'rejected';
    setTokens(data.accessToken, data.refreshToken);
    return 'ok';
  } catch {
    return 'unreachable';
  }
}

// Mutex: when multiple requests get 401 simultaneously, only one refresh
// call is made; all callers await the same promise.
let refreshInFlight: Promise<RefreshResult> | null = null;

async function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const sent = latestRefreshToken();
    if (!sent) return 'rejected';
    const result = await exchangeRefreshToken(sent);
    if (result !== 'rejected') return result;
    // Another tab may have rotated the token while this request was in flight.
    const newer = latestRefreshToken();
    return newer && newer !== sent ? exchangeRefreshToken(newer) : 'rejected';
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

/** A refresh that failed for network reasons: keep the session, let the caller retry. */
function serverUnreachable() {
  return new ApiError(503, 'Could not reach Carbonexo. Check your connection and try again.', {});
}

// In-flight GET request deduplication (prevents redundant parallel requests)
const inFlight = new Map<string, Promise<unknown>>();

// Short-lived memory cache for idempotent GET requests
interface CacheEntry {
  data: unknown;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

export function clearApiCache(pathPrefix?: string) {
  if (!pathPrefix) {
    cache.clear();
    return;
  }
  cache.forEach((_, key) => {
    if (key.startsWith(pathPrefix)) {
      cache.delete(key);
    }
  });
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  const isGet = !options.method || options.method.toUpperCase() === 'GET';

  // Return cached result if valid
  if (isGet && !options.headers) {
    const cached = cache.get(path);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
  }

  // Deduplicate concurrent GET requests to the same path.
  //
  // Retries must bypass this. The post-refresh retry below is issued from
  // *inside* the in-flight promise registered for this same path, so handing it
  // that promise would make the promise await itself and never settle — every
  // GET that got a 401 would hang instead of replaying.
  if (isGet && retryCount === 0 && inFlight.has(path)) {
    return inFlight.get(path) as Promise<T>;
  }

  const fetchPromise = (async () => {
    const epoch = sessionEpoch;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    // Don't set Content-Type for FormData (multipart upload)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    // After a hard navigation the access token is gone but the refresh token is in storage:
    // refresh first (once, shared by concurrent calls) instead of sending every first request
    // unauthenticated and collecting a 401 for each.
    if (!accessToken && retryCount === 0 && !path.startsWith('/api/auth/') && latestRefreshToken()) {
      const refreshed = await refreshAccessToken();
      if (refreshed === 'unreachable') throw serverUnreachable();
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    // 401 — try refresh once. Not for the auth endpoints themselves: a wrong
    // password is a 401 that must reach the form, not reload the page.
    if (res.status === 401 && retryCount === 0 && !path.startsWith('/api/auth/')) {
      const refreshed = await refreshAccessToken();
      if (refreshed === 'ok') {
        return apiFetch<T>(path, options, retryCount + 1);
      }
      if (refreshed === 'unreachable') throw serverUnreachable();
      clearTokens();
      toLogin();
      throw new ApiError(401, 'Session expired', {});
    }

    // Signed out (here or in another tab) while this request was in flight.
    if (epoch !== sessionEpoch && !path.startsWith('/api/auth/')) {
      throw new ApiError(401, 'Signed out', {});
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.detail || res.statusText, body.errors);
    }

    // Handle 204 No Content
    if (res.status === 204) return undefined as T;

    const data = await res.json();

    // Cache successful GET results for static catalogs
    if (isGet && (path.includes('/rewards') || path.includes('/action-templates') || path.includes('/factors'))) {
      cache.set(path, { data, expiresAt: Date.now() + 60000 });
    }

    return data as T;
  })();

  // Only the outermost call owns the in-flight entry; a retry resolves through
  // its parent, so waiters still receive the replayed result.
  if (isGet && retryCount === 0) {
    inFlight.set(path, fetchPromise);
    fetchPromise
      .catch(() => {})
      .finally(() => {
        inFlight.delete(path);
      });
  }

  return fetchPromise;
}

/**
 * Like apiFetch, but for endpoints that return a raw text body (e.g. CSV)
 * instead of JSON. Mirrors apiFetch's auth-header attachment and 401
 * refresh-and-retry behavior exactly, without the res.json() assumption.
 */
export async function apiFetchText(
  path: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<string> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retryCount === 0) {
    const refreshed = await refreshAccessToken();
    if (refreshed === 'ok') {
      return apiFetchText(path, options, retryCount + 1);
    }
    if (refreshed === 'unreachable') throw serverUnreachable();
    clearTokens();
    toLogin();
    throw new ApiError(401, 'Session expired', {});
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body || res.statusText);
  }

  return res.text();
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  getText: (path: string) => apiFetchText(path),
  post: <T>(path: string, body?: unknown) => {
    clearApiCache();
    return apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  },
  put: <T>(path: string, body?: unknown) => {
    clearApiCache();
    return apiFetch<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  },
  patch: <T>(path: string, body?: unknown) => {
    clearApiCache();
    return apiFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
  },
  delete: <T>(path: string) => {
    clearApiCache();
    return apiFetch<T>(path, { method: 'DELETE' });
  },
  upload: <T>(path: string, formData: FormData) => {
    clearApiCache();
    return apiFetch<T>(path, { method: 'POST', body: formData });
  },
};
