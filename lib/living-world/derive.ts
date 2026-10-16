/**
 * Living World — pure derivations from product data to the view model.
 *
 * Rules this file enforces (each has a test):
 *  - Planet health follows the user's *average per logged day*, never the
 *    number of entries. Logging more often does not heal or harm the planet.
 *  - Nothing here uses the dashboard's fixed 8 kg/day "saved" baseline.
 *  - A trend needs at least two logged days in each of the two weeks.
 *  - Sparse logs pull the planet toward neutral and say so (confidence).
 *  - Scenarios are applied on top of the actual average and stay labelled
 *    hypothetical; they never feed back into `actual`.
 *
 * No React, no DOM, no fetch.
 */

import { ACTIONS, dayKey, round1, type Category } from '../carbon';
import type {
  ActualFootprint,
  Confidence,
  DayTotal,
  GoalState,
  LedgerFacts,
  LivingWorldState,
  Milestone,
  ScenarioState,
  Trend,
  WorldVisual,
} from './types';

// ─── Sourced references ──────────────────────────────────────────────────────

/** UNEP (2020) "1.5-Degree Lifestyles": 2.5 t CO₂e per person per year by 2030. */
export const LIFESTYLE_BUDGET_KG_PER_DAY = 2500 / 365;
export const LIFESTYLE_BUDGET_SOURCE = 'UNEP (2020) 1.5-Degree Lifestyles — 2.5 t CO₂e per person per year by 2030';

/** OWID / Global Carbon Project, world CO₂ per capita, 2024: 4.7 t. */
export const WORLD_AVG_KG_PER_DAY = (4.7 * 1000) / 365;
export const WORLD_AVG_SOURCE = 'OWID / Global Carbon Project, world average CO₂ per person, 2024';

/** At this multiple of the lifestyle budget the planet reads fully degraded. */
const DEGRADED_MULTIPLE = 3;

const EMPTY_BREAKDOWN = (): Record<Category, number> => ({ travel: 0, food: 0, electricity: 0, shopping: 0, waste: 0 });

// ─── Days ────────────────────────────────────────────────────────────────────

/** 14 day buckets ending `today`, oldest first, from raw entries. */
export function buildDays(entries: { date: string; kg: number }[], today: Date = new Date()): DayTotal[] {
  const byDate = new Map<string, { kg: number; n: number }>();
  for (const e of entries) {
    const b = byDate.get(e.date) ?? { kg: 0, n: 0 };
    b.kg += e.kg;
    b.n += 1;
    byDate.set(e.date, b);
  }
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (13 - i));
    const key = dayKey(d);
    const b = byDate.get(key);
    return { date: key, kg: round1(b?.kg ?? 0), logged: (b?.n ?? 0) > 0 };
  });
}

function avgLogged(days: DayTotal[]): number | null {
  const logged = days.filter((d) => d.logged);
  if (logged.length === 0) return null;
  return logged.reduce((s, d) => s + d.kg, 0) / logged.length;
}

export function confidenceFor(loggedDays: number): Confidence {
  if (loggedDays <= 0) return 'none';
  if (loggedDays < 3) return 'low';
  if (loggedDays < 7) return 'medium';
  return 'high';
}

const CONFIDENCE_WEIGHT: Record<Confidence, number> = { none: 0, low: 0.35, medium: 0.7, high: 1 };

// ─── Trend ───────────────────────────────────────────────────────────────────

export function deriveTrend(days: DayTotal[]): Trend {
  const last = days.slice(0, 7);
  const cur = days.slice(7);
  const lastN = last.filter((d) => d.logged).length;
  const curN = cur.filter((d) => d.logged).length;
  if (lastN < 2 || curN < 2) {
    return { direction: 'unknown', pct: null, basis: 'Needs at least two logged days in each of the last two weeks.' };
  }
  const a = avgLogged(last)!;
  const b = avgLogged(cur)!;
  if (a <= 0) return { direction: 'unknown', pct: null, basis: 'Last week averaged 0 kg per logged day.' };
  const pct = Math.round(((b - a) / a) * 100);
  const direction = Math.abs(pct) < 5 ? 'flat' : pct < 0 ? 'down' : 'up';
  return { direction, pct, basis: 'Average per logged day, this week vs last week.' };
}

// ─── Actual ──────────────────────────────────────────────────────────────────

export interface ActualInput {
  provenance: 'logged' | 'example';
  days: DayTotal[];
  weekBreakdown?: Partial<Record<Category, number>>;
  streak: number;
}

export function deriveActual({ provenance, days, weekBreakdown, streak }: ActualInput): ActualFootprint {
  const last = days.slice(0, 7);
  const cur = days.slice(7);
  const loggedDaysThisWeek = cur.filter((d) => d.logged).length;
  const loggedDaysLastWeek = last.filter((d) => d.logged).length;
  const breakdown = { ...EMPTY_BREAKDOWN(), ...(weekBreakdown ?? {}) };

  let biggest: ActualFootprint['biggest'] = null;
  for (const [c, kg] of Object.entries(breakdown) as [Category, number][]) {
    if (kg > 0 && (!biggest || kg > biggest.kg)) biggest = { category: c, kg: round1(kg) };
  }

  const avg = avgLogged(days);
  return {
    provenance,
    days,
    todayKg: days[days.length - 1]?.kg ?? 0,
    thisWeekKg: round1(cur.reduce((s, d) => s + d.kg, 0)),
    lastWeekKg: loggedDaysLastWeek > 0 ? round1(last.reduce((s, d) => s + d.kg, 0)) : null,
    loggedDaysThisWeek,
    loggedDaysLastWeek,
    avgPerLoggedDayKg: avg === null ? null : round1(avg),
    trend: deriveTrend(days),
    biggest,
    weekBreakdown: breakdown,
    streak,
    confidence: confidenceFor(loggedDaysThisWeek + loggedDaysLastWeek),
  };
}

// ─── Vitality ────────────────────────────────────────────────────────────────

/**
 * Raw planet health for an average daily footprint: 1 at or under the 1.5 °C
 * lifestyle budget, 0 at three times it, logarithmic in between (each
 * doubling of emissions costs the same).
 */
export function vitalityForDailyKg(kg: number): number {
  if (!Number.isFinite(kg) || kg <= LIFESTYLE_BUDGET_KG_PER_DAY) return 1;
  const v = 1 - Math.log(kg / LIFESTYLE_BUDGET_KG_PER_DAY) / Math.log(DEGRADED_MULTIPLE);
  return Math.max(0, Math.min(1, v));
}

/** Pull toward neutral (0.5) when the evidence is thin. */
export function weighByConfidence(v: number, c: Confidence): number {
  return 0.5 + (v - 0.5) * CONFIDENCE_WEIGHT[c];
}

export function deriveVisual(actual: ActualFootprint): WorldVisual {
  const avg = actual.avgPerLoggedDayKg;
  const isExample = actual.provenance === 'example';
  if (avg === null) {
    return {
      vitality: 0.5,
      provenance: actual.provenance,
      confidence: 'none',
      basis: 'Nothing logged in the last 14 days, so the planet stays neutral.',
      caption: 'Log a few days to bring your planet to life.',
    };
  }
  const vitality = weighByConfidence(vitalityForDailyKg(avg), actual.confidence);
  const vsBudget = avg / LIFESTYLE_BUDGET_KG_PER_DAY;
  const rel = vsBudget <= 1 ? 'within the 1.5 °C budget' : `${vsBudget.toFixed(1)}× the 1.5 °C budget`;
  return {
    vitality,
    provenance: actual.provenance,
    confidence: actual.confidence,
    basis: `${isExample ? 'Example' : 'Your logged'} average of ${avg.toFixed(1)} kg CO₂e per logged day, compared with a 1.5 °C lifestyle budget of ${LIFESTYLE_BUDGET_KG_PER_DAY.toFixed(1)} kg/day (${LIFESTYLE_BUDGET_SOURCE}).`,
    caption: `${isExample ? 'Example day' : 'From your logs'} · ${rel} · ${confidenceLabel(actual.confidence)}`,
  };
}

export function confidenceLabel(c: Confidence): string {
  return c === 'high' ? 'well logged' : c === 'medium' ? 'partly logged' : c === 'low' ? 'few logs — rough' : 'no logs';
}

// ─── Scenario ────────────────────────────────────────────────────────────────

export interface ScenarioInput {
  label: string;
  horizon: 'MONTH' | 'YEAR';
  baselineKg: number;
  projectedKg: number;
  deltaKg: number;
  source: 'server' | 'offline-estimate';
}

export function deriveScenario(s: ScenarioInput): ScenarioState {
  const weeks = s.horizon === 'YEAR' ? 52 : 4.33;
  return { provenance: 'hypothetical', ...s, weeklyDeltaKg: round1(s.deltaKg / weeks) };
}

/**
 * The planet if the scenario were adopted: the scenario's weekly change is
 * applied to the user's actual daily average (or the world average when they
 * have no logs yet, which is then named as the starting point).
 */
export function deriveScenarioVisual(actual: ActualFootprint, scenario: ScenarioState): WorldVisual {
  const hasActual = actual.avgPerLoggedDayKg !== null;
  const base = hasActual ? actual.avgPerLoggedDayKg! : WORLD_AVG_KG_PER_DAY;
  const projected = Math.max(0, base + scenario.weeklyDeltaKg / 7);
  const confidence: Confidence = hasActual ? actual.confidence : 'low';
  const vitality = weighByConfidence(vitalityForDailyKg(projected), hasActual ? confidence : 'high');
  const from = hasActual ? 'your logged daily average' : `the world average (${WORLD_AVG_SOURCE})`;
  return {
    vitality,
    provenance: 'hypothetical',
    confidence,
    basis: `Hypothetical: ${scenario.label} applied to ${from}, ${base.toFixed(1)} → ${projected.toFixed(1)} kg/day. Nothing has been logged or saved.`,
    caption: `What if · ${projected.toFixed(1)} kg/day · hypothetical`,
  };
}

/** The same base the scenario visual uses, without the change — for side-by-side comparison. */
export function deriveScenarioBaseVisual(actual: ActualFootprint): WorldVisual {
  if (actual.avgPerLoggedDayKg !== null) return deriveVisual(actual);
  return {
    vitality: vitalityForDailyKg(WORLD_AVG_KG_PER_DAY),
    provenance: 'sourced',
    confidence: 'high',
    basis: `No logs yet, so the comparison starts from ${WORLD_AVG_SOURCE}: ${WORLD_AVG_KG_PER_DAY.toFixed(1)} kg/day.`,
    caption: `World average · ${WORLD_AVG_KG_PER_DAY.toFixed(1)} kg/day · sourced`,
  };
}

// ─── Goal ────────────────────────────────────────────────────────────────────

export interface GoalInput {
  weeklyGoalPct: number;
  plan: { templateId: string; done: boolean }[];
}

export function deriveGoal(actual: ActualFootprint, { weeklyGoalPct, plan }: GoalInput): GoalState {
  const done = plan.filter((p) => p.done);
  const completedSavingEstimateKg = round1(done.reduce((s, p) => s + (ACTIONS.find((a) => a.id === p.templateId)?.saving ?? 0), 0));
  const targetKg = actual.lastWeekKg !== null && actual.lastWeekKg > 0 ? round1((actual.lastWeekKg * weeklyGoalPct) / 100) : null;
  return {
    provenance: 'estimate',
    weeklyGoalPct,
    targetKg,
    plannedActions: plan.length,
    completedActions: done.length,
    completedSavingEstimateKg,
    progress: targetKg ? Math.min(1, completedSavingEstimateKg / targetKg) : null,
    basis: targetKg
      ? `Target: ${weeklyGoalPct}% of last week's logged ${actual.lastWeekKg} kg. Progress uses catalog estimates for completed actions, not measured savings.`
      : 'A target appears once last week has logged days.',
  };
}

// ─── Milestones ──────────────────────────────────────────────────────────────

export function deriveMilestones(actual: ActualFootprint, ledger: LedgerFacts | null): Milestone[] {
  const logged14 = actual.loggedDaysThisWeek + actual.loggedDaysLastWeek;
  const actions = ledger?.distinctActionsDone ?? 0;
  const bills = ledger?.billsConfirmed ?? 0;
  const p = (n: number, of: number) => Math.max(0, Math.min(1, n / of));
  return [
    { id: 'first-log', label: 'First log', detail: 'Logged your first activity.', reached: logged14 > 0 || actual.streak > 0, progress: p(logged14, 1) },
    { id: 'streak-3', label: '3-day streak', detail: 'Logged three days in a row.', reached: actual.streak >= 3, progress: p(actual.streak, 3) },
    { id: 'streak-7', label: '7-day streak', detail: 'Logged a full week in a row.', reached: actual.streak >= 7, progress: p(actual.streak, 7) },
    { id: 'week-logged', label: 'Full picture', detail: 'Logged on 7 of the last 14 days.', reached: logged14 >= 7, progress: p(logged14, 7) },
    { id: 'first-action', label: 'First action', detail: 'Completed an action from your plan.', reached: actions >= 1, progress: p(actions, 1) },
    { id: 'five-actions', label: 'Five actions', detail: 'Completed five different actions.', reached: actions >= 5, progress: p(actions, 5) },
    { id: 'bill-confirmed', label: 'Metered', detail: 'Confirmed an electricity bill.', reached: bills >= 1, progress: p(bills, 1) },
    {
      id: 'lighter-week',
      label: 'Lighter week',
      detail: 'Your per-day average fell versus last week.',
      reached: actual.trend.direction === 'down',
      progress: actual.trend.direction === 'down' ? 1 : actual.trend.direction === 'unknown' ? 0 : 0.5,
    },
  ];
}

// ─── Ledger ──────────────────────────────────────────────────────────────────

export function ledgerFacts(history: { delta: number; ruleKey: string | null; refType?: string | null; id?: string; refId?: string | null }[], balance: number): LedgerFacts {
  const actionRefs = new Set<string>();
  const billRefs = new Set<string>();
  for (const h of history) {
    if (h.ruleKey === 'action_done') actionRefs.add(h.refId ?? h.id ?? String(actionRefs.size));
    if (h.ruleKey === 'bill_upload') billRefs.add(h.refId ?? h.id ?? String(billRefs.size));
  }
  return { distinctActionsDone: actionRefs.size, billsConfirmed: billRefs.size, balance };
}

// ─── Story (landing) ─────────────────────────────────────────────────────────

/**
 * Landing-page vitality from story progress 0…1: a dark, hazed planet that
 * greens as the visitor reads on. Illustrative — it tracks the story, not data.
 */
export function storyVitality(progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  const e = t * t * (3 - 2 * t);
  return 0.06 + 0.94 * e;
}

// ─── Assembly ────────────────────────────────────────────────────────────────

export interface LivingWorldInput {
  actual: ActualInput;
  goal: GoalInput;
  ledger: LedgerFacts | null;
  scenario: ScenarioInput | null;
}

export function buildLivingWorld(input: LivingWorldInput): LivingWorldState {
  const actual = deriveActual(input.actual);
  const scenario = input.scenario ? deriveScenario(input.scenario) : null;
  return {
    actual,
    goal: deriveGoal(actual, input.goal),
    scenario,
    milestones: deriveMilestones(actual, input.ledger),
    ledger: input.ledger,
    visual: deriveVisual(actual),
    scenarioVisual: scenario ? deriveScenarioVisual(actual, scenario) : null,
  };
}
