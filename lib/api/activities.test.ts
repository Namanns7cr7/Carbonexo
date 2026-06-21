import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getActivities, createActivity, deleteActivity } from './activities';

describe('activities API helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getActivities queries the correct path', async () => {
    const mockLogs = [{ id: '1', label: 'Commute', co2Kg: 2.1 }];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => mockLogs,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const logs = await getActivities('2026-06-01', '2026-06-07');
    expect(logs).toEqual(mockLogs);
    const url = (fetchMock.mock.calls[0] as any)[0] as string;
    expect(url).toContain('/api/activities?from=2026-06-01&to=2026-06-07');
  });

  it('createActivity posts activity data', async () => {
    const mockRes = { id: 'x', label: 'Test log', co2Kg: 5.5 };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => mockRes,
    }));
    vi.stubGlobal('fetch', fetchMock);

    const payload = { category: 'food', label: 'Fish', co2Kg: 5.5, activityDate: '2026-06-21' };
    const res = await createActivity(payload);
    expect(res).toEqual(mockRes);

    const opts = (fetchMock.mock.calls[0] as any)[1] as RequestInit;
    expect(opts.method).toBe('POST');
    expect(opts.body).toContain('Fish');
    expect(opts.body).toContain('food');
  });

  it('deleteActivity makes a DELETE call', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 204,
      json: async () => ({}),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await deleteActivity('log-123');
    const url = (fetchMock.mock.calls[0] as any)[0] as string;
    expect(url).toContain('/api/activities/log-123');
    const opts = (fetchMock.mock.calls[0] as any)[1] as RequestInit;
    expect(opts.method).toBe('DELETE');
  });
});
