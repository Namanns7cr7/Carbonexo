import { describe, it, expect, vi, afterEach } from 'vitest';
import { getRewards, redeemReward, getRedemptions } from './rewards';

function stubFetch(payload: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: true, status: 200, statusText: 'OK', json: async () => payload,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('rewards API helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('getRewards reads the rewards catalogue', async () => {
    const fetchMock = stubFetch([{ id: 'r1', title: 'Tote bag' }]);
    const res = await getRewards();
    expect(res[0].title).toBe('Tote bag');
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/rewards');
  });

  it('redeemReward POSTs to the per-reward redeem path', async () => {
    const fetchMock = stubFetch({ id: 'red1', status: 'PENDING' });
    const res = await redeemReward('r1');
    expect(res.status).toBe('PENDING');
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/rewards/r1/redeem');
    expect(((fetchMock.mock.calls[0] as any)[1] as RequestInit).method).toBe('POST');
  });

  it('getRedemptions reads the redemptions history', async () => {
    const fetchMock = stubFetch([]);
    await getRedemptions();
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/rewards/redemptions');
  });
});
