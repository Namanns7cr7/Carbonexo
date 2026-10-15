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

export async function getEsgSummary(): Promise<EsgSummaryResponse> {
  return api.get<EsgSummaryResponse>('/api/reports/esg-summary');
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
