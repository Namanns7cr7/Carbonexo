import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getRecommendations, analyzeElectricity, getDailyTip,
  sendCoachMessage, getCoachHistory, sendCoachFeedback,
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

  it('sendCoachMessage sends the page route and title as pageContext', async () => {
    const fetchMock = stubFetch({ result: 'contextual answer', model: 'Gemini 3 Flash' });
    const ctx = { route: '/app/credits', pageTitle: 'Green Credits', activeFeature: 'rewards', contextVersion: 1 };
    const res = await sendCoachMessage('How do I earn more?', ctx);
    expect(res.result).toBe('contextual answer');
    expect(res.model).toBe('Gemini 3 Flash');
    const body = JSON.parse(((fetchMock.mock.calls[0] as any)[1] as RequestInit).body as string);
    expect(body).toEqual({ message: 'How do I earn more?', pageContext: { route: '/app/credits', pageTitle: 'Green Credits' } });
  });

  it('sendCoachMessage omits context when the page has no title', async () => {
    const fetchMock = stubFetch({ result: 'ok' });
    await sendCoachMessage('hello', { route: '/app', contextVersion: 1 } as any);
    const body = JSON.parse(((fetchMock.mock.calls[0] as any)[1] as RequestInit).body as string);
    expect(body).toEqual({ message: 'hello' });
  });

  it('getCoachHistory reads the history endpoint', async () => {
    const fetchMock = stubFetch([{ id: '1', role: 'user', content: 'hi', createdAt: 'now' }]);
    const res = await getCoachHistory();
    expect(res).toHaveLength(1);
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/ai/coach/history');
  });
  it('sendCoachFeedback posts rating, reasons and opt-in consent to the response', async () => {
    const fetchMock = stubFetch({ feedback_id: 'f1' });
    await sendCoachFeedback('r 1', { rating: -1, reasons: ['incorrect_number'], consentResearch: false });
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/ai/responses/r%201/feedback');
    const opts = (fetchMock.mock.calls[0] as any)[1] as RequestInit;
    expect(opts.method).toBe('POST');
    expect(opts.body).toContain('"consentResearch":false');
    expect(opts.body).toContain('incorrect_number');
  });
});
