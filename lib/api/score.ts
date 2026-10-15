import { api } from './client';

export interface CreditScoreResponse {
  score: number;
  tier: string;
  balancePoints: number;
  streakPoints: number;
  consistencyPoints: number;
  balance: number;
  streak: number;
  daysActiveLast30: number;
}

export async function getScore(): Promise<CreditScoreResponse> {
  return api.get<CreditScoreResponse>('/api/credits/score');
}
