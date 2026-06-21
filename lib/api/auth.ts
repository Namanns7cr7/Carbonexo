import { api, setTokens, clearTokens, loadStoredRefreshToken, getAccessToken } from './client';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; displayName: string; role: string };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/api/auth/login', { email, password });
  setTokens(res.accessToken, res.refreshToken);
  return res;
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/api/auth/register', { email, password, displayName });
  setTokens(res.accessToken, res.refreshToken);
  return res;
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/api/auth/google', { idToken });
  setTokens(res.accessToken, res.refreshToken);
  return res;
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

