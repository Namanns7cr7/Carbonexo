import { api, ApiError, setTokens, clearTokens, beginSignOut, loadStoredRefreshToken, getAccessToken } from './client';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; displayName: string; role: string };
}

/**
 * Network failures (server down, offline) surface as a plain, actionable
 * message. Carbonexo never fabricates a session when the server cannot
 * confirm one: a fake token only fails later, somewhere more confusing.
 */
function explain(err: unknown): never {
  if (err instanceof TypeError || (err instanceof Error && /fetch|network/i.test(err.message))) {
    throw new Error("Can't reach the Carbonexo server right now. Check your connection and try again.");
  }
  throw err;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await api.post<AuthResponse>('/api/auth/login', { email, password });
    setTokens(res.accessToken, res.refreshToken);
    return res;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) throw new Error('That email and password do not match an account.');
    return explain(err);
  }
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  try {
    const res = await api.post<AuthResponse>('/api/auth/register', { email, password, displayName });
    setTokens(res.accessToken, res.refreshToken);
    return res;
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) throw new Error('An account with this email already exists. Try logging in.');
    if (err instanceof ApiError && err.errors && Object.keys(err.errors).length > 0) {
      throw new Error(Object.values(err.errors).join(' '));
    }
    return explain(err);
  }
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  try {
    const res = await api.post<AuthResponse>('/api/auth/google', { idToken });
    setTokens(res.accessToken, res.refreshToken);
    return res;
  } catch (err) {
    return explain(err);
  }
}

/**
 * Ends the session: this browser's credentials and user data are cleared
 * first, so nothing in flight can use or repopulate them, then the server
 * revokes the refresh token. The access token is a stateless JWT and stays
 * valid until it expires (JWT_ACCESS_TTL, 15 min), but no copy of it is
 * left in this browser.
 *
 * Resolves true when the server confirmed the revocation; false when it
 * could not be reached twice (the local session is gone either way).
 */
export async function logout(): Promise<boolean> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('cx-refresh') : null;
  beginSignOut();
  if (!token) return true;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await api.post('/api/auth/logout', { refreshToken: token });
      return true;
    } catch (err) {
      // a 4xx means the server already considers the token unusable
      if (err instanceof ApiError && err.status < 500) return true;
    }
  }
  console.warn('[Carbonexo] Signed out here, but the server could not confirm the refresh token was revoked.');
  return false;
}

/** The one sign-out action every button uses: end the session, then land on the home page. */
export async function signOut(): Promise<void> {
  await logout();
  // replace: Back must not return to the signed-in page that was just left
  window.location.replace('/');
}

/**
 * Returns true if the user has a valid access or refresh token.
 *
 * Pure predicate — does NOT mutate module state. Call
 * `loadStoredRefreshToken()` once at app startup to ensure the in-memory
 * token is populated from storage before calling this.
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken() || !!(typeof window !== 'undefined' && localStorage.getItem('cx-refresh'));
}

export { setTokens, clearTokens, loadStoredRefreshToken };

