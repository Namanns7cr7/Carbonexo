import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getRecommendations, analyzeElectricity, getDailyTip,
  sendCoachMessage, getCoachHistory,
} from './ai';

function stubFetch(payload: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: true, status: 200, statusText: 'OK', json: async () => payload,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('ai API helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('getRecommendations unwraps the result field', async () => {
    const fetchMock = stubFetch({ result: 'cut your commute' });
    const res = await getRecommendations();
    expect(res).toBe('cut your commute');
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/ai/recommendations');
  });

  it('analyzeElectricity posts units and billing month', async () => {
    const fetchMock = stubFetch({ result: 'high usage' });
    const res = await analyzeElectricity(340, '2026-05');
    expect(res).toBe('high usage');
    const opts = (fetchMock.mock.calls[0] as any)[1] as RequestInit;
    expect(opts.method).toBe('POST');
    expect(opts.body).toContain('340');
    expect(opts.body).toContain('2026-05');
  });

  it('getDailyTip uses GET and unwraps result', async () => {
    const fetchMock = stubFetch({ result: 'walk today' });
    const res = await getDailyTip();
    expect(res).toBe('walk today');
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/ai/daily-tip');
  });

  it('sendCoachMessage returns the full coach response (result + prompt)', async () => {
    const fetchMock = stubFetch({ result: 'sure!', prompt: 'rendered prompt' });
    const res = await sendCoachMessage('how do I save energy?');
    expect(res.result).toBe('sure!');
    expect(res.prompt).toBe('rendered prompt');
    const opts = (fetchMock.mock.calls[0] as any)[1] as RequestInit;
    expect(opts.body).toContain('how do I save energy?');
  });

  it('getCoachHistory reads the history endpoint', async () => {
    const fetchMock = stubFetch([{ id: '1', role: 'user', content: 'hi', createdAt: 'now' }]);
    const res = await getCoachHistory();
    expect(res).toHaveLength(1);
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/ai/coach/history');
  });
});
