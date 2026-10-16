import { api } from './client';

export type SimulationHorizon = 'MONTH' | 'YEAR';
export type SimulationDeltaType = 'REPLACE_WITH' | 'REDUCE_BY';

export interface SimulationChange {
  /** Either factorKey (an activity from the shared catalog) OR both customLabel
   * and customFactorKgPerUnit must be set — the latter lets a user simulate
   * something that isn't in the catalog. */
  factorKey?: string;
  category: string;
  quantity: number;
  frequency: string; // e.g. "per_day" | "per_week" | "per_month"
  deltaType: SimulationDeltaType;
  replacementFactorKey?: string;
  amount?: number;
  customLabel?: string;
  customFactorKgPerUnit?: number;
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

import { DEFAULT_EMISSION_FACTORS } from './dashboard';

function simulateClientSide(request: SimulationRequestBody): SimulationResult {
  const horizonWeeks = request.horizon === 'YEAR' ? 52 : 4.33;
  let baselineTotal = 0;
  let projectedTotal = 0;
  const breakdown: SimulationBreakdownItem[] = [];

  for (const change of request.changes) {
    const factor = DEFAULT_EMISSION_FACTORS.find((f) => f.factorKey === change.factorKey);
    const factorRate = change.customFactorKgPerUnit ?? factor?.factorKgPerUnit ?? 0.18;
    const weeklyFreq = change.frequency === 'per_day' ? 7 : change.frequency === 'per_month' ? 0.25 : 1;
    const horizonQty = change.quantity * weeklyFreq * horizonWeeks;
    const baseKg = Math.round(horizonQty * factorRate * 10) / 10;

    let projKg = baseKg;
    if (change.deltaType === 'REPLACE_WITH') {
      const repFactor = DEFAULT_EMISSION_FACTORS.find((f) => f.factorKey === change.replacementFactorKey);
      const repRate = repFactor?.factorKgPerUnit ?? 0.04;
      projKg = Math.round(horizonQty * repRate * 10) / 10;
    } else {
      const amt = change.amount ?? 1;
      const reducedQty = Math.max(0, change.quantity - amt) * weeklyFreq * horizonWeeks;
      projKg = Math.round(reducedQty * factorRate * 10) / 10;
    }

    baselineTotal += baseKg;
    projectedTotal += projKg;
    breakdown.push({
      factorKey: change.factorKey ?? change.customLabel ?? 'custom',
      baselineKg: baseKg,
      projectedKg: projKg,
    });
  }

  const delta = Math.round((projectedTotal - baselineTotal) * 10) / 10;
  const creditsDelta = Math.max(0, Math.round(-delta * 10));

  return {
    baselineCo2Kg: Math.round(baselineTotal * 10) / 10,
    projectedCo2Kg: Math.round(projectedTotal * 10) / 10,
    deltaCo2Kg: delta,
    weeklyGoalImpact: {
      currentProgressPct: 45,
      projectedProgressPct: Math.min(100, Math.max(0, Math.round(45 + (delta < 0 ? Math.abs(delta) * 0.8 : 0)))),
    },
    projectedCreditsDelta: creditsDelta,
    breakdown,
    aiInsight:
      delta < 0
        ? `By making this change, you prevent ~${Math.abs(delta)} kg of CO₂ emissions and earn ${creditsDelta} Eco Credits!`
        : 'Simulation projected successfully.',
  };
}

/** Runs a read-only "carbon twin" what-if simulation — nothing is persisted. */
export async function runSimulation(request: SimulationRequestBody): Promise<SimulationResult> {
  try {
    return await api.post<SimulationResult>('/api/simulations', request);
  } catch (err) {
    console.warn('Simulation API unavailable, falling back to local simulation engine:', err);
    return simulateClientSide(request);
  }
}
