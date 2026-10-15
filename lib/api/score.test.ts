import { describe, it, expect, vi, afterEach } from 'vitest';
import { getScore } from './score';

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

describe('score API helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('getScore GETs /api/credits/score and returns the result', async () => {
    const payload = {
      score: 612,
      tier: 'Sapling',
      balancePoints: 220,
      streakPoints: 80,
      consistencyPoints: 12,
      balance: 440,
      streak: 8,
      daysActiveLast30: 4,
    };
    const fetchMock = stubFetch(payload);

    const res = await getScore();

    expect(res.score).toBe(612);
    expect(res.tier).toBe('Sapling');

    const call = fetchMock.mock.calls[0] as any;
    expect(call[0]).toContain('/api/credits/score');
  });
});
