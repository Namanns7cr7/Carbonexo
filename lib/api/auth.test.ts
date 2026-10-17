import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { login, register, logout, isAuthenticated } from './auth';
import { clearTokens, getAccessToken } from './client';

describe('auth API helpers', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    clearTokens();
    store = {};
    const localStorageMock = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value.toString(); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; }
    };
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('login posts credentials and caches tokens', async () => {
    const mockAuthResponse = {
      accessToken: 'acc_token',
      refreshToken: 'ref_token',
      expiresIn: 3600,
      user: { id: '1', email: 'a@b.com', displayName: 'Yash', role: 'USER' },
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => mockAuthResponse,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await login('a@b.com', 'pass');
    expect(res.accessToken).toBe('acc_token');
    expect(getAccessToken()).toBe('acc_token');
    expect(localStorage.getItem('cx-refresh')).toBe('ref_token');
  });

  it('register posts userdata and caches tokens', async () => {
    const mockAuthResponse = {
      accessToken: 'acc_token_reg',
      refreshToken: 'ref_token_reg',
      expiresIn: 3600,
      user: { id: '2', email: 'reg@b.com', displayName: 'Reggy', role: 'USER' },
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => mockAuthResponse,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await register('reg@b.com', 'pass', 'Reggy');
    expect(res.accessToken).toBe('acc_token_reg');
    expect(localStorage.getItem('cx-refresh')).toBe('ref_token_reg');
  });

  it('a wrong password surfaces an error and creates no session (no refresh, no redirect)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ detail: 'Bad credentials' }) }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(login('demo@b.com', 'wrong')).rejects.toThrow(/do not match/);
    expect(getAccessToken()).toBeNull();
    expect(isAuthenticated()).toBe(false);
    // Only the login call: the auth endpoint must not trigger the refresh flow.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('an unreachable server is reported, never papered over with a fake token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    await expect(login('alex@b.com', 'pass')).rejects.toThrow(/reach the Carbonexo server/);
    await expect(register('new@b.com', 'pass', 'New')).rejects.toThrow(/reach the Carbonexo server/);
    expect(isAuthenticated()).toBe(false);
  });

  it('a duplicate registration says so instead of signing in locally', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 409, statusText: 'Conflict', json: async () => ({ detail: 'exists' }) })));

    await expect(register('taken@b.com', 'pass', 'T')).rejects.toThrow(/already exists/);
    expect(isAuthenticated()).toBe(false);
  });

  it('isAuthenticated checks in-memory token and storage', () => {
    expect(isAuthenticated()).toBe(false);

    localStorage.setItem('cx-refresh', 'dummy');
    expect(isAuthenticated()).toBe(true);
  });
});
