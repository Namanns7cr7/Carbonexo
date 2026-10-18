import { api } from './client';
import type { EcoMindPageContext } from '../context/ecomind-context';

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

export interface CoachCitation {
  marker: string;           // "S1" - matches [S1] in the answer text
  kind: string;             // factor_source | knowledge
  title: string;
  resource?: string;
  locator?: string;
  review_status?: string;   // APPROVED | CANDIDATE (not yet reviewed by a person) | label text
}

/** Server limit for one coach message (AIController.MAX_COACH_MESSAGE_CHARS); longer input is rejected with a 400. */
export const COACH_MESSAGE_MAX_CHARS = 2000;

export interface CoachResponse {
  result: string;
  prompt?: string;
  /** Who actually produced `result` ("gemini", "carbonexo" for limits); absent when there is no live answer. */
  provider?: string | null;
  model?: string | null;
  live?: boolean | null;
  /** Why no live answer was produced (e.g. MODEL_NOT_FOUND, RATE_LIMITED, CIRCUIT_OPEN). */
  failure?: string | null;
  responseId?: string | null;
  citations?: CoachCitation[];
  toolsUsed?: string[];
  checks?: Record<string, unknown>;
  pageContextApplied?: boolean;
}

export type FeedbackReason =
  | 'incorrect_number' | 'wrong_citation' | 'missing_citation' | 'not_relevant' | 'unsafe_advice'
  | 'unsupported_claim' | 'ignored_my_data' | 'wrong_region' | 'too_long' | 'unclear'
  | 'helpful' | 'accurate' | 'well_sourced';

export interface CoachFeedback {
  rating: 1 | -1;
  reasons?: FeedbackReason[];
  comment?: string;
  correction?: string;
  /** Opt-in: reviewers may use this conversation to improve the coach. Default false. */
  consentResearch?: boolean;
}

export async function sendCoachFeedback(responseId: string, feedback: CoachFeedback): Promise<{ feedback_id: string }> {
  return api.post<{ feedback_id: string }>(`/api/ai/responses/${encodeURIComponent(responseId)}/feedback`, feedback);
}

export async function sendCoachMessage(
  message: string,
  pageContext?: EcoMindPageContext
): Promise<CoachResponse> {
  const payload: Record<string, unknown> = { message };
  if (pageContext?.pageTitle) {
    payload.context = `${pageContext.pageTitle}${pageContext.activeFeature ? ` - ${pageContext.activeFeature}` : ''}`;
  }
  return api.post<CoachResponse>('/api/ai/coach', payload);
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
