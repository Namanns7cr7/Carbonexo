/**
 * Living World — the one environmental view model every screen reads.
 *
 * Carbonexo shows several kinds of numbers that must never be confused:
 *
 *   logged        what the user recorded (self-reported, client-estimated per entry)
 *   example       a labelled example day, for visitors with no account
 *   estimate      a catalog estimate (e.g. an action's typical weekly saving)
 *   hypothetical  a Carbon Twin what-if — nothing happened
 *   illustrative  story visuals on the landing page, not data at all
 *   sourced       third-party reference data (OWID, UNEP) with a citation
 *
 * Every channel below carries one of these. The renderer only ever receives a
 * `WorldVisual`, which keeps its provenance and a plain-language basis so the
 * UI can always say *why* the planet looks the way it does.
 *
 * Pure types — no React, no DOM.
 */

import type { Category } from '../carbon';

export type Provenance = 'logged' | 'example' | 'estimate' | 'hypothetical' | 'illustrative' | 'sourced';

export type Confidence = 'none' | 'low' | 'medium' | 'high';

export interface DayTotal {
  /** YYYY-MM-DD, local. */
  date: string;
  kg: number;
  /** Whether anything was logged that day (a 0 kg walk still counts). */
  logged: boolean;
}

/** What the user actually logged. Never contains savings. */
export interface ActualFootprint {
  provenance: 'logged' | 'example';
  /** Oldest first; 14 days ending today. */
  days: DayTotal[];
  todayKg: number;
  thisWeekKg: number;
  /** null when the previous week has no logged days. */
  lastWeekKg: number | null;
  loggedDaysThisWeek: number;
  loggedDaysLastWeek: number;
  /** Average over logged days only, so logging more often does not move it by itself. */
  avgPerLoggedDayKg: number | null;
  trend: Trend;
  biggest: { category: Category; kg: number } | null;
  weekBreakdown: Record<Category, number>;
  streak: number;
  confidence: Confidence;
}

export interface Trend {
  direction: 'down' | 'up' | 'flat' | 'unknown';
  /** This week's per-logged-day average vs last week's, %. null when unknown. */
  pct: number | null;
  basis: string;
}

/** Goal and plan — estimates from the action catalog, not measurements. */
export interface GoalState {
  provenance: 'estimate';
  weeklyGoalPct: number;
  /** Weekly reduction target in kg, from last week's logged total. null without a prior week. */
  targetKg: number | null;
  plannedActions: number;
  completedActions: number;
  completedSavingEstimateKg: number;
  /** 0…1 toward the target using estimated savings, or null without a target. */
  progress: number | null;
  basis: string;
}

/** A Carbon Twin what-if. Never mixed into actual. */
export interface ScenarioState {
  provenance: 'hypothetical';
  label: string;
  horizon: 'MONTH' | 'YEAR';
  baselineKg: number;
  projectedKg: number;
  deltaKg: number;
  /** delta spread per week, for comparing against a weekly footprint. */
  weeklyDeltaKg: number;
  /** Where the numbers came from. */
  source: 'server' | 'offline-estimate';
}

/** A milestone reached from persisted data only. */
export interface Milestone {
  id: MilestoneId;
  label: string;
  detail: string;
  reached: boolean;
  /** 0…1 toward reaching it. */
  progress: number;
}

export type MilestoneId =
  | 'first-log'
  | 'streak-3'
  | 'streak-7'
  | 'week-logged'
  | 'first-action'
  | 'five-actions'
  | 'bill-confirmed'
  | 'lighter-week';

/** Facts about persisted engagement, read from the credit ledger. */
export interface LedgerFacts {
  /** Distinct actions completed (ledger refIds under action_done). */
  distinctActionsDone: number;
  billsConfirmed: number;
  balance: number;
}

export interface GeoState {
  layer: 'none' | 'co2' | 'grid';
  selectedIso: string | null;
}

/** What the renderer gets. Both values are 0…1 and spring-smoothed downstream. */
export interface WorldVisual {
  /** 0 = degraded, smog-hazed Earth · 1 = lush, clear, green Earth. */
  vitality: number;
  provenance: Provenance;
  confidence: Confidence;
  /** One plain sentence explaining what drives the colour right now. */
  basis: string;
  /** Short caption for under the globe. */
  caption: string;
}

export interface LivingWorldState {
  actual: ActualFootprint;
  goal: GoalState;
  scenario: ScenarioState | null;
  milestones: Milestone[];
  ledger: LedgerFacts | null;
  /** The planet as the user's logs describe it. */
  visual: WorldVisual;
  /** The planet if the scenario were adopted. null without a scenario. */
  scenarioVisual: WorldVisual | null;
}
