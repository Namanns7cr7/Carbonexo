import { describe, it, expect, vi, afterEach } from 'vitest';
import { getDashboard, getEmissionFactors } from './dashboard';

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

describe('dashboard API helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('getDashboard queries /api/dashboard and returns parsed data', async () => {
    const data = { todayTotal: 6.8, streak: 5 };
    const fetchMock = stubFetch(data);

    const res = await getDashboard();

    expect(res).toEqual(data);
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/dashboard');
  });

  it('getEmissionFactors defaults to the GLOBAL region', async () => {
    const fetchMock = stubFetch([]);
    await getEmissionFactors();
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/emission-factors?region=GLOBAL');
  });

  it('getEmissionFactors passes a custom region', async () => {
    const fetchMock = stubFetch([]);
    await getEmissionFactors('IN');
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('region=IN');
  });
});
