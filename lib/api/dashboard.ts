import { api } from './client';

export interface DashboardData {
  todayTotal: number;
  yesterdayTotal: number;
  deltaPct: number;
  todayBreakdown: Record<string, number>;
  weekBreakdown: Record<string, number>;
  weekTotals: { date: string; total: number }[];
  biggestCategory: string | null;
  biggestValue: number;
  streak: number;
  totalSaved: number;
  todayLogs: { id: string; category: string; label: string; emoji: string; co2Kg: number; note: string }[];
}

export async function getDashboard(): Promise<DashboardData> {
  return api.get<DashboardData>('/api/dashboard');
}

export interface EmissionFactorData {
  id: string;
  category: string;
  factorKey: string;
  label: string;
  emoji: string;
  unit: string;
  factorKgPerUnit: number;
  defaultQty: number;
}

export async function getEmissionFactors(region = 'GLOBAL'): Promise<EmissionFactorData[]> {
  return api.get<EmissionFactorData[]>(`/api/emission-factors?region=${region}`);
}
