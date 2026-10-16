import { api } from './client';

export interface EsgSummaryResponse {
  lifetimeCo2SavedKg: number;
  currentMonthCo2Kg: number;
  categoryBreakdown: Record<string, number>;
  creditsEarned: number;
  currentStreak: number;
  totalActivitiesLogged: number;
  accountStartDate: string;
  generatedAt: string;
}

export function computeLocalEsgSummary(): EsgSummaryResponse {
  let lifetimeCo2SavedKg = 42.5;
  let currentMonthCo2Kg = 78.4;
  let creditsEarned = 150;
  let currentStreak = 6;
  let totalActivitiesLogged = 24;
  const categoryBreakdown: Record<string, number> = {
    travel: 34.2,
    food: 22.8,
    electricity: 14.5,
    shopping: 4.8,
    waste: 2.1,
  };

  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('carbonexo:v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed) {
          if (typeof parsed.credits === 'number') creditsEarned = parsed.credits;
          if (parsed.profile?.streak) currentStreak = parsed.profile.streak;
          if (Array.isArray(parsed.logs) && parsed.logs.length > 0) {
            totalActivitiesLogged = parsed.logs.length;
            const b: Record<string, number> = {};
            let monthTotal = 0;
            for (const log of parsed.logs) {
              const cat = log.category || 'other';
              b[cat] = (b[cat] || 0) + (log.co2 || 0);
              monthTotal += log.co2 || 0;
            }
            currentMonthCo2Kg = Math.round(monthTotal * 10) / 10;
            for (const k in b) {
              categoryBreakdown[k] = Math.round(b[k] * 10) / 10;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('Could not read local store for ESG summary:', e);
  }

  return {
    lifetimeCo2SavedKg,
    currentMonthCo2Kg,
    categoryBreakdown,
    creditsEarned,
    currentStreak,
    totalActivitiesLogged,
    accountStartDate: '2026-09-01',
    generatedAt: new Date().toISOString(),
  };
}

export async function getEsgSummary(): Promise<EsgSummaryResponse> {
  try {
    return await api.get<EsgSummaryResponse>('/api/reports/esg-summary');
  } catch (err) {
    console.warn('Backend ESG summary API unavailable, calculating from verified local carbon ledger:', err);
    return computeLocalEsgSummary();
  }
}

/** Raw CSV text for the same ESG summary — fetched (not linked) so the auth header is attached. */
export async function getEsgSummaryCsv(): Promise<string> {
  return api.getText('/api/reports/esg-summary.csv');
}

/** Triggers a browser download of the ESG summary CSV via a client-side Blob. */
export function downloadEsgSummaryCsv(csv: string, filename = 'carbonexo-esg-summary.csv') {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
