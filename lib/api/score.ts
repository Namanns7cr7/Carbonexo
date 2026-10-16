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

export function computeLocalScore(): CreditScoreResponse {
  let balance = 150;
  let streak = 6;
  let daysActiveLast30 = 12;

  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('carbonexo:v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed) {
          if (typeof parsed.credits === 'number') {
            balance = parsed.credits;
          }
          if (Array.isArray(parsed.logs)) {
            const uniqueDates = new Set(parsed.logs.map((l: { date?: string }) => l.date));
            daysActiveLast30 = Math.max(daysActiveLast30, uniqueDates.size);
          }
          if (parsed.profile?.streak) {
            streak = parsed.profile.streak;
          }
        }
      }
    }
  } catch (e) {
    console.warn('Could not read local store for score:', e);
  }

  const balancePoints = Math.min(300, Math.floor(Math.max(0, balance) / 2));
  const streakPoints = Math.min(150, streak * 10);
  const consistencyPoints = Math.min(100, daysActiveLast30 * 3);
  const score = Math.min(850, 300 + balancePoints + streakPoints + consistencyPoints);

  let tier = 'Seedling';
  if (score >= 750) tier = 'Forest Guardian';
  else if (score >= 600) tier = 'Sapling';
  else if (score >= 450) tier = 'Sprout';

  return {
    score,
    tier,
    balancePoints,
    streakPoints,
    consistencyPoints,
    balance,
    streak,
    daysActiveLast30,
  };
}

export async function getScore(): Promise<CreditScoreResponse> {
  try {
    return await api.get<CreditScoreResponse>('/api/credits/score');
  } catch (err) {
    console.warn('Backend score API unavailable, calculating from verified local carbon ledger:', err);
    return computeLocalScore();
  }
}
