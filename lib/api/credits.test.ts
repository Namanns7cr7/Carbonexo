import { describe, it, expect, vi, afterEach } from 'vitest';
import { getBalance, getHistory, completeAction } from './credits';

function stubFetch(payload: unknown, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => payload,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('credits API helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('getBalance reads the balance endpoint', async () => {
    const fetchMock = stubFetch({ userId: 'u1', balance: 120 });
    const res = await getBalance();
    expect(res.balance).toBe(120);
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/credits/balance');
  });

  it('getHistory reads the history endpoint', async () => {
    const fetchMock = stubFetch([{ id: '1', delta: 10 }]);
    const res = await getHistory();
    expect(res).toHaveLength(1);
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/credits/history');
  });

  it('completeAction POSTs with a URL-encoded actionKey', async () => {
    const fetchMock = stubFetch({}, 204);
    await completeAction('use public transport');
    const url = (fetchMock.mock.calls[0] as any)[0] as string;
    expect(url).toContain('/api/credits/action?actionKey=use%20public%20transport');
    expect(((fetchMock.mock.calls[0] as any)[1] as RequestInit).method).toBe('POST');
  });
});
