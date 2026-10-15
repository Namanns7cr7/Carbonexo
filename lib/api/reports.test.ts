import { describe, it, expect, vi, afterEach } from 'vitest';
import { getEsgSummary, getEsgSummaryCsv } from './reports';

function stubFetchJson(payload: unknown, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => payload,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stubFetchText(text: string, status = 200) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    text: async () => text,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('reports API helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('getEsgSummary GETs /api/reports/esg-summary and returns the result', async () => {
    const payload = {
      lifetimeCo2SavedKg: 120.5,
      currentMonthCo2Kg: 15.2,
      categoryBreakdown: { travel: 80, diet: 40.5 },
      creditsEarned: 340,
      currentStreak: 5,
      totalActivitiesLogged: 42,
      accountStartDate: '2025-01-01',
      generatedAt: '2026-10-15T00:00:00Z',
    };
    const fetchMock = stubFetchJson(payload);

    const res = await getEsgSummary();

    expect(res.lifetimeCo2SavedKg).toBe(120.5);
    expect(res.categoryBreakdown.travel).toBe(80);

    const call = fetchMock.mock.calls[0] as any;
    expect(call[0]).toContain('/api/reports/esg-summary');
  });

  it('getEsgSummaryCsv GETs the .csv endpoint and returns raw text', async () => {
    const csv = 'metric,value\nlifetimeCo2SavedKg,120.5\n';
    const fetchMock = stubFetchText(csv);

    const res = await getEsgSummaryCsv();

    expect(res).toBe(csv);
    const call = fetchMock.mock.calls[0] as any;
    expect(call[0]).toContain('/api/reports/esg-summary.csv');
  });
});
