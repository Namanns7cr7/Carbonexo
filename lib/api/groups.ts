import { api } from './client';

export interface GroupMember {
  userId: string;
  displayName: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  members: GroupMember[];
}

export interface GroupSummary {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  rank: number;
  value: number;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  aiSummary: string | null;
}

export interface GoalProgress {
  groupId: string;
  combinedCurrentKg: number;
  combinedGoalKg: number;
  progressPct: number;
  memberCount: number;
}

export type LeaderboardWindow = 'week' | 'month' | 'all';
export type LeaderboardMetric = 'co2_saved' | 'credits';

export async function createGroup(name: string): Promise<Group> {
  return api.post<Group>('/api/groups', { name });
}

export async function joinGroup(inviteCode: string): Promise<Group> {
  return api.post<Group>('/api/groups/join', { inviteCode });
}

export async function getMyGroups(): Promise<GroupSummary[]> {
  return api.get<GroupSummary[]>('/api/groups/mine');
}

export async function getGroupDetail(id: string): Promise<Group> {
  return api.get<Group>(`/api/groups/${id}`);
}

export async function getLeaderboard(
  id: string,
  window: LeaderboardWindow = 'week',
  metric: LeaderboardMetric = 'co2_saved'
): Promise<LeaderboardResult> {
  return api.get<LeaderboardResult>(
    `/api/groups/${id}/leaderboard?window=${window}&metric=${metric}`
  );
}

export async function getGoalProgress(id: string): Promise<GoalProgress> {
  return api.get<GoalProgress>(`/api/groups/${id}/goal-progress`);
}
