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

export async function sendCoachMessage(message: string): Promise<string> {
  const res = await api.post<{ result: string }>('/api/ai/coach', { message });
  return res.result;
}

export async function getCoachHistory(): Promise<{ id: string; role: string; content: string; createdAt: string }[]> {
  return api.get('/api/ai/coach/history');
}
