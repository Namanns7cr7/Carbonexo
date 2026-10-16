import { api } from './client';

export async function getRecommendations(): Promise<string> {
  const res = await api.post<{ result: string }>('/api/ai/recommendations');
  return res.result;
}

export async function analyzeElectricity(units: number, billingMonth: string): Promise<string> {
  const res = await api.post<{ result: string }>('/api/ai/electricity-analysis', { units, billingMonth });
  return res.result;
}

export async function getTransportInsights(): Promise<string> {
  const res = await api.post<{ result: string }>('/api/ai/transport-insights');
  return res.result;
}

export async function getDailyTip(): Promise<string> {
  const res = await api.get<{ result: string }>('/api/ai/daily-tip');
  return res.result;
}

export async function getMonthlyReport(period: string): Promise<string> {
  const res = await api.post<{ result: string }>('/api/ai/monthly-report', { period });
  return res.result;
}

export interface CoachResponse {
  result: string;
  prompt?: string;
}

export async function sendCoachMessage(message: string): Promise<CoachResponse> {
  return api.post<CoachResponse>('/api/ai/coach', { message });
}

export interface CoachHistoryEntry {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  provider?: string;
  model?: string;
}

export async function getCoachHistory(): Promise<CoachHistoryEntry[]> {
  return api.get<CoachHistoryEntry[]>('/api/ai/coach/history');
}

export interface CursorPage<T> {
  items: T[];
  nextCursorCreatedAt: string | null;
  nextCursorId: string | null;
  hasMore: boolean;
}

/**
 * Fetch coach history using sub-50ms cursor-based pagination.
 */
export async function getCoachHistoryPaged(
  cursorCreatedAt?: string,
  cursorId?: string,
  limit = 20
): Promise<CursorPage<CoachHistoryEntry>> {
  const params = new URLSearchParams();
  if (cursorCreatedAt) params.append('cursorCreatedAt', cursorCreatedAt);
  if (cursorId) params.append('cursorId', cursorId);
  params.append('limit', String(limit));
  return api.get<CursorPage<CoachHistoryEntry>>(`/api/ai/coach/history/paged?${params.toString()}`);
}
