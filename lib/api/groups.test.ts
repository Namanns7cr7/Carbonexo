import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createGroup,
  joinGroup,
  getMyGroups,
  getGroupDetail,
  getLeaderboard,
  getGoalProgress,
} from './groups';

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

describe('groups API helpers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('createGroup POSTs the group name', async () => {
    const mockGroup = { id: 'g1', name: 'Home Crew', inviteCode: 'ABCD1234', createdBy: 'u1', members: [] };
    const fetchMock = stubFetch(mockGroup, 201);

    const res = await createGroup('Home Crew');

    expect(res).toEqual(mockGroup);
    const url = (fetchMock.mock.calls[0] as any)[0] as string;
    const opts = (fetchMock.mock.calls[0] as any)[1] as RequestInit;
    expect(url).toContain('/api/groups');
    expect(opts.method).toBe('POST');
    expect(opts.body).toContain('Home Crew');
  });

  it('joinGroup POSTs the invite code', async () => {
    const mockGroup = { id: 'g1', name: 'Home Crew', inviteCode: 'ABCD1234', createdBy: 'u1', members: [] };
    const fetchMock = stubFetch(mockGroup);

    const res = await joinGroup('ABCD1234');

    expect(res).toEqual(mockGroup);
    const url = (fetchMock.mock.calls[0] as any)[0] as string;
    const opts = (fetchMock.mock.calls[0] as any)[1] as RequestInit;
    expect(url).toContain('/api/groups/join');
    expect(opts.method).toBe('POST');
    expect(opts.body).toContain('ABCD1234');
  });

  it('getMyGroups reads the mine endpoint', async () => {
    const fetchMock = stubFetch([{ id: 'g1', name: 'Home Crew', inviteCode: 'ABCD1234', memberCount: 3 }]);

    const res = await getMyGroups();

    expect(res).toHaveLength(1);
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/groups/mine');
  });

  it('getGroupDetail reads the group by id', async () => {
    const mockGroup = { id: 'g1', name: 'Home Crew', inviteCode: 'ABCD1234', createdBy: 'u1', members: [] };
    const fetchMock = stubFetch(mockGroup);

    const res = await getGroupDetail('g1');

    expect(res).toEqual(mockGroup);
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/groups/g1');
  });

  it('getLeaderboard passes window and metric query params', async () => {
    const fetchMock = stubFetch([{ userId: 'u1', displayName: 'Alice', rank: 1, value: 12.5 }]);

    const res = await getLeaderboard('g1', 'month', 'credits');

    expect(res).toHaveLength(1);
    const url = (fetchMock.mock.calls[0] as any)[0] as string;
    expect(url).toContain('/api/groups/g1/leaderboard');
    expect(url).toContain('window=month');
    expect(url).toContain('metric=credits');
  });

  it('getLeaderboard defaults to week / co2_saved', async () => {
    const fetchMock = stubFetch([]);

    await getLeaderboard('g1');

    const url = (fetchMock.mock.calls[0] as any)[0] as string;
    expect(url).toContain('window=week');
    expect(url).toContain('metric=co2_saved');
  });

  it('getGoalProgress reads the goal-progress endpoint', async () => {
    const mockProgress = { groupId: 'g1', combinedCurrentKg: 10, combinedGoalKg: 20, progressPct: 50, memberCount: 2 };
    const fetchMock = stubFetch(mockProgress);

    const res = await getGoalProgress('g1');

    expect(res).toEqual(mockProgress);
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('/api/groups/g1/goal-progress');
  });
});
