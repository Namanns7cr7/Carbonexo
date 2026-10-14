import { api } from './client';

export type SimulationHorizon = 'MONTH' | 'YEAR';
export type SimulationDeltaType = 'REPLACE_WITH' | 'REDUCE_BY';

export interface SimulationChange {
  factorKey: string;
  category: string;
  quantity: number;
  frequency: string; // e.g. "per_day" | "per_week" | "per_month"
  deltaType: SimulationDeltaType;
  replacementFactorKey?: string;
  amount?: number;
}

export interface SimulationRequestBody {
  changes: SimulationChange[];
  horizon: SimulationHorizon;
}

export interface SimulationBreakdownItem {
  factorKey: string;
  baselineKg: number;
  projectedKg: number;
}

export interface SimulationWeeklyGoalImpact {
  currentProgressPct: number;
  projectedProgressPct: number;
}

export interface SimulationResult {
  baselineCo2Kg: number;
  projectedCo2Kg: number;
  deltaCo2Kg: number;
  weeklyGoalImpact: SimulationWeeklyGoalImpact;
  projectedCreditsDelta: number;
  breakdown: SimulationBreakdownItem[];
  aiInsight: string | null;
}

/** Runs a read-only "carbon twin" what-if simulation — nothing is persisted. */
export async function runSimulation(request: SimulationRequestBody): Promise<SimulationResult> {
  return api.post<SimulationResult>('/api/simulations', request);
}
