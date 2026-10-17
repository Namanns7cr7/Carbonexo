/**
 * Adapters from the app's existing data (lib/store.tsx `useCarbon()`,
 * lib/api/credits.ts) to the visualization props in ./types.
 *
 * Pure mapping only — no fetching, no business rules. Anything the existing
 * data can't honestly provide (a weekly budget in kg, certified credits) is
 * NOT synthesised here; the integrator passes it or the component shows its
 * empty state.
 */

import { CATEGORIES, CATEGORY_META, type Category } from '../carbon';
import type { PlanRow } from '../store/types';
import type { ActionItem, DailyFootprintData, GreenPointsBalance, ReductionItem, WeeklyPoint } from './types';

/** `todayKey`, `todayTotal`, `todayBreakdown` → DailyFootprint. */
export function toDailyFootprint(
  todayKey: string,
  todayTotal: number,
  todayBreakdown: Record<Category, number>,
  goalKg?: number
): DailyFootprintData {
  return {
    date: todayKey,
    kg: Math.round(todayTotal * 100) / 100,
    goalKg,
    byCategory: CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      kg: Math.round((todayBreakdown[c.id] ?? 0) * 100) / 100,
      color: CATEGORY_META[c.id].color,
    })).filter((s) => s.kg > 0),
  };
}

/** `weekTotals` → WeeklyProgression series. */
export function toWeeklySeries(weekTotals: { key: string; total: number }[]): WeeklyPoint[] {
  return weekTotals.map((d) => ({ date: d.key, kg: Math.round(d.total * 100) / 100 }));
}

/**
 * Plan rows → ActionCompletion items. Savings come from the action catalog,
 * so they are estimates, and labelled so.
 */
export function toActionItems(plan: PlanRow[]): ActionItem[] {
  return plan.map((p) => ({
    id: p.templateId,
    title: p.template.title,
    done: p.done,
    kgPerWeek: p.template.saving,
    basis: 'estimate',
  }));
}

/** Completed plan rows → ReductionEstimates (catalog estimates, not measurements). */
export function toReductions(plan: PlanRow[]): ReductionItem[] {
  return plan
    .filter((p) => p.done)
    .map((p) => ({ id: p.templateId, label: p.template.title, kgPerWeek: p.template.saving, basis: 'estimate' as const }));
}

/**
 * GET /api/credits/balance → Green Points. These are the app's internal
 * reward points (credit_ledger), shown as points — never as tonnes or credits.
 */
export function toGreenPoints(balance: { balance: number } | null | undefined, earnedThisMonth?: number): GreenPointsBalance | null {
  if (!balance) return null;
  return { kind: 'green-points', balance: balance.balance, earnedThisMonth };
}

/** Sum of positive ledger deltas since the start of the current month. */
export function pointsEarnedThisMonth(history: { delta: number; createdAt: string }[], now: Date = new Date()): number {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return history.filter((h) => h.delta > 0 && new Date(h.createdAt).getTime() >= start).reduce((s, h) => s + h.delta, 0);
}
