import { api, ApiError, setTokens, clearTokens, loadStoredRefreshToken, getAccessToken } from './client';

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

export async function logout(): Promise<void> {
  try {
    await api.post('/api/auth/logout', { refreshToken: localStorage.getItem('cx-refresh') });
  } catch {
    // Ignore errors on logout — tokens are cleared regardless.
  }
  clearTokens();
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

