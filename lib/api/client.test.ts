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
