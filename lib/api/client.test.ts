import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setTokens, getAccessToken, clearTokens, ApiError, api } from './client';

describe('api client — token management', () => {
  beforeEach(() => clearTokens());

  it('stores and returns the in-memory access token', () => {
    setTokens('access-1', 'refresh-1');
    expect(getAccessToken()).toBe('access-1');
  });

  it('clears the access token', () => {
    setTokens('a', 'b');
    clearTokens();
    expect(getAccessToken()).toBeNull();
  });
});

describe('apiFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('attaches the bearer token and returns parsed json', async () => {
    setTokens('tok', 'ref');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ hello: 'world' }) }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await api.get<{ hello: string }>('/x');

    expect(res).toEqual({ hello: 'world' });
    const opts = (fetchMock.mock.calls[0] as any)[1] as RequestInit;
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer tok');
  });

  it('throws a typed ApiError on a non-ok response', async () => {
    clearTokens();
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ detail: 'nope' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/x')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('apiFetch — 401 refresh and replay', () => {
  // A browser-like global scope, so the refresh token persists the way it does in a tab.
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', { location: { href: '' } });
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
    });
  });
  afterEach(() => { clearTokens(); vi.unstubAllGlobals(); });

  // Regression: in-flight GET deduplication used to intercept the post-refresh
  // retry, handing it the promise it was itself running inside. The request
  // never settled, so any expired-token GET hung forever.
  it('replays a 401 GET after a successful refresh instead of deadlocking', async () => {
    setTokens('stale-access', 'good-refresh');
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls++;
      if (String(url).includes('/api/auth/refresh')) {
        return { ok: true, status: 200, json: async () => ({ accessToken: 'fresh', refreshToken: 'r2' }) };
      }
      if (calls === 1) return { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ replayed: true }) };
    }));

    const result = await Promise.race([
      api.get<{ replayed: boolean }>('/api/dashboard'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('request never settled — deadlock regressed')), 2500)),
    ]);

    expect(result).toEqual({ replayed: true });
    expect(getAccessToken()).toBe('fresh');
  }, 6000);

  it('gives up and raises ApiError when the refresh itself fails', async () => {
    setTokens('stale-access', 'bad-refresh');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/api/auth/refresh')) {
        return { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) };
      }
      return { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) };
    }));

    await expect(api.get('/api/dashboard')).rejects.toBeInstanceOf(ApiError);
    expect(localStorage.getItem('cx-refresh')).toBeNull();
  });

  it('keeps the session when the refresh fails for network reasons', async () => {
    setTokens('stale-access', 'good-refresh');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/api/auth/refresh')) throw new TypeError('Failed to fetch');
      return { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) };
    }));

    await expect(api.get('/api/dashboard')).rejects.toMatchObject({ status: 503 });
    expect(localStorage.getItem('cx-refresh')).toBe('good-refresh');
  });

  it('keeps the session when the refresh endpoint has a server error', async () => {
    setTokens('stale-access', 'good-refresh');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/api/auth/refresh')) {
        return { ok: false, status: 502, statusText: 'Bad Gateway', json: async () => ({}) };
      }
      return { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) };
    }));

    await expect(api.get('/api/dashboard')).rejects.toMatchObject({ status: 503 });
    expect(localStorage.getItem('cx-refresh')).toBe('good-refresh');
  });

  it('refreshes with the token another tab stored, not the one this tab loaded with', async () => {
    setTokens('stale-access', 'old-refresh');
    localStorage.setItem('cx-refresh', 'rotated-by-other-tab');
    const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/api/auth/refresh')) {
        const token = JSON.parse(String(init?.body)).refreshToken;
        sent.push(token);
        return token === 'rotated-by-other-tab'
          ? { ok: true, status: 200, json: async () => ({ accessToken: 'fresh', refreshToken: 'r3' }) }
          : { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) };
      }
      const authed = (init?.headers as Record<string, string>)?.Authorization === 'Bearer fresh';
      return authed
        ? { ok: true, status: 200, json: async () => ({ ok: 1 }) }
        : { ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({}) };
    }));

    await expect(api.get('/api/dashboard')).resolves.toEqual({ ok: 1 });
    expect(sent).toEqual(['rotated-by-other-tab']);
  });
});

describe('apiFetch — GET deduplication and caching', () => {
  afterEach(() => { vi.unstubAllGlobals(); clearTokens(); });

  it('collapses concurrent GETs to the same path into one request', async () => {
    setTokens('tok', 'ref');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ n: 1 }) }));
    vi.stubGlobal('fetch', fetchMock);

    const [a, b, c] = await Promise.all([api.get('/api/groups'), api.get('/api/groups'), api.get('/api/groups')]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ n: 1 });
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('does not dedupe across different paths', async () => {
    setTokens('tok', 'ref');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ n: 1 }) }));
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([api.get('/api/groups'), api.get('/api/activities')]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serves catalog GETs from cache, and a mutation invalidates it', async () => {
    setTokens('tok', 'ref');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) }));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/api/rewards');
    await api.get('/api/rewards');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await api.post('/api/rewards/redeem', { id: 'r1' });
    await api.get('/api/rewards');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('clearTokens drops cached responses so a new session cannot read them', async () => {
    setTokens('tok', 'ref');
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) }));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/api/rewards');
    clearTokens();
    setTokens('tok2', 'ref2');
    await api.get('/api/rewards');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
