import { describe, it, expect, vi, afterEach } from 'vitest';
import { getProfile, updateProfile, completeOnboarding } from './profile';

function stubFetch(payload: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: true, status: 200, statusText: 'OK', json: async () => payload,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('profile API helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('getProfile reads /api/profiles/me', async () => {
    const fetchMock = stubFetch({ name: 'Yash', onboarded: true });
    const res = await getProfile();
    expect(res.name).toBe('Yash');
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/profiles/me');
  });

  it('updateProfile sends a PUT with the patch body', async () => {
    const fetchMock = stubFetch({ name: 'New' });
    await updateProfile({ name: 'New', weeklyGoalPct: 25 });
    const opts = (fetchMock.mock.calls[0] as any)[1] as RequestInit;
    expect(opts.method).toBe('PUT');
    expect(opts.body).toContain('New');
    expect(opts.body).toContain('25');
  });

  it('completeOnboarding POSTs to the onboarding endpoint', async () => {
    const fetchMock = stubFetch({ onboarded: true });
    const res = await completeOnboarding();
    expect(res.onboarded).toBe(true);
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/profiles/me/onboarding');
    expect(((fetchMock.mock.calls[0] as any)[1] as RequestInit).method).toBe('POST');
  });
});
