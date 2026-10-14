import { describe, it, expect, vi, afterEach } from 'vitest';
import { runSimulation } from './simulations';

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

describe('simulations API helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('runSimulation POSTs the request to /api/simulations and returns the result', async () => {
    const payload = {
      baselineCo2Kg: 100,
      projectedCo2Kg: 80,
      deltaCo2Kg: -20,
      weeklyGoalImpact: { currentProgressPct: 0, projectedProgressPct: 60 },
      projectedCreditsDelta: 12,
      breakdown: [{ factorKey: 'car_ride', baselineKg: 15.588, projectedKg: 4.33 }],
    };
    const fetchMock = stubFetch(payload);

    const res = await runSimulation({
      changes: [
        {
          factorKey: 'car_ride',
          category: 'travel',
          quantity: 20,
          frequency: 'per_week',
          deltaType: 'REPLACE_WITH',
          replacementFactorKey: 'public_transport',
        },
      ],
      horizon: 'MONTH',
    });

    expect(res.projectedCo2Kg).toBe(80);
    expect(res.breakdown).toHaveLength(1);

    const call = fetchMock.mock.calls[0] as any;
    expect(call[0]).toContain('/api/simulations');
    expect(call[1].method).toBe('POST');
    const body = JSON.parse(call[1].body);
    expect(body.horizon).toBe('MONTH');
    expect(body.changes[0].factorKey).toBe('car_ride');
  });
});
