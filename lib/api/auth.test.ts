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

  it('isAuthenticated checks in-memory token and storage', () => {
    expect(isAuthenticated()).toBe(false);

    localStorage.setItem('cx-refresh', 'dummy');
    expect(isAuthenticated()).toBe(true);
  });
});
