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
  customReplacementLabel?: string;
  customReplacementFactorKgPerUnit?: number;
  /** Type within the activity for the user's region (e.g. car_ride petrol_hatch_lt1400cc); omit for a range over types. */
  variant?: string;
  replacementVariant?: string;
}

export interface SimulationRequestBody {
  changes: SimulationChange[];
  horizon: SimulationHorizon;
}

export type SimulationStatus = 'ESTIMATED' | 'ESTIMATED_RANGE' | 'PARTIAL' | 'NOT_ESTIMATED';

export interface SimulationBreakdownItem {
  factorKey: string;
  /** Exact figures; null unless status is ESTIMATED. */
  baselineKg: number | null;
  projectedKg: number | null;
  status?: SimulationStatus;
  baselineKgMin?: number | null;
  baselineKgMax?: number | null;
  projectedKgMin?: number | null;
  projectedKgMax?: number | null;
  missingInformation?: string | null;
  factorSource?: 'registry' | 'user_supplied';
}

export interface SimulationWeeklyGoalImpact {
  currentProgressPct: number;
  projectedProgressPct: number;
}

export interface SimulationResult {
  /** Exact totals: set only when status is ESTIMATED (otherwise use the min/max delta). */
  baselineCo2Kg: number | null;
  projectedCo2Kg: number | null;
  deltaCo2Kg: number | null;
  weeklyGoalImpact: SimulationWeeklyGoalImpact;
  projectedCreditsDelta: number;
  breakdown: SimulationBreakdownItem[];
  aiInsight: string | null;
  /** ESTIMATED | ESTIMATED_RANGE (type not stated) | PARTIAL (some changes not estimated) | NOT_ESTIMATED. */
  status?: SimulationStatus;
  deltaCo2KgMin?: number | null;
  deltaCo2KgMax?: number | null;
  /** Factor registry version and its review authority: APPROVED, CANDIDATE (unreviewed) or NONE. */
  factorDatasetVersion?: string;
  factorAuthority?: 'APPROVED' | 'CANDIDATE' | 'NONE';
  source?: 'server';
}

/**
 * Runs a read-only "carbon twin" what-if simulation — nothing is persisted.
 *
 * The server's registry is the only calculator (the same one the AI coach uses). There is no
 * browser fallback: an unreachable server is an error, never a local guess with stand-in factors.
 */
export async function runSimulation(
  request: SimulationRequestBody,
  options?: { insight?: boolean }
): Promise<SimulationResult> {
  const query = options?.insight !== undefined ? `?insight=${options.insight}` : '';
  const res = await api.post<SimulationResult>(`/api/simulations${query}`, request);
  return { ...res, source: 'server' };
}
