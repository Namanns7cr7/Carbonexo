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
    expect(res.source).toBe('server');
  });

  const change = { factorKey: 'car_ride', category: 'travel', quantity: 10, frequency: 'per_week', deltaType: 'REPLACE_WITH' as const, replacementFactorKey: 'metro_train' };

  it('a server rejection is surfaced, not replaced by a local guess', async () => {
    stubFetch({ detail: 'replacementFactorKey is required' }, 400);
    await expect(runSimulation({ changes: [change], horizon: 'MONTH' })).rejects.toThrow(/replacementFactorKey/);
  });

  it('an unreachable server is an error, never a browser estimate with stand-in factors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(runSimulation({ changes: [change], horizon: 'MONTH' })).rejects.toThrow();
  });

  it('passes through not-estimated results without inventing totals', async () => {
    stubFetch({
      baselineCo2Kg: null, projectedCo2Kg: null, deltaCo2Kg: null, status: 'NOT_ESTIMATED',
      weeklyGoalImpact: { currentProgressPct: 0, projectedProgressPct: 0 }, projectedCreditsDelta: 0, aiInsight: 'Not estimated: metro',
      breakdown: [{ factorKey: 'car_ride', baselineKg: null, projectedKg: null, status: 'NOT_ESTIMATED', missingInformation: 'a verified Indian metro factor' }],
    });
    const res = await runSimulation({ changes: [change], horizon: 'MONTH' });
    expect(res.status).toBe('NOT_ESTIMATED');
    expect(res.deltaCo2Kg).toBeNull();
  });
});
