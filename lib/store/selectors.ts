/**
 * Carbonexo store — pure derived-value helpers (selectors).
 *
 * These functions compute derived state from raw logs / plan. They have no
 * React imports, no side effects, and are easy to unit-test.
 */
import { ACTIONS, dayKey, dayTotal, breakdown, round1, type Category, type LogEntry } from '@/lib/carbon';
import type { PersistedState, PlanRow, CarbonCtxValue } from './types';

// ─── Streak ───────────────────────────────────────────────────────────────────

/**
 * Returns the number of consecutive days (counting back from today) that
 * contain at least one log entry.
 */
export function computeStreak(logs: LogEntry[]): number {
  const datesWithLogs = new Set(logs.map((l) => l.date));
  let streak = 0;
  const today = new Date();
  for (;;) {
    const key = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - streak));
    if (datesWithLogs.has(key)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ─── Local context value builder ──────────────────────────────────────────────

/**
 * Computes the full context value from local (localStorage-backed) state.
 * Called when the user is not authenticated.
 */
export function buildLocalContextValue(
  state: PersistedState,
  hydrated: boolean,
  bootstrapped: boolean,
  actions: Pick<CarbonCtxValue, 'addLog' | 'removeLog' | 'addPlan' | 'removePlan' | 'togglePlan' | 'saveProfile' | 'completeOnboarding' | 'resetAll'>,
): CarbonCtxValue {
  const week = getWeekDays();
  const todayKey = week[6];
  const yesterdayKey = week[5];

  const todayLogs = state.logs.filter((l) => l.date === todayKey);
  const todayTotal = round1(dayTotal(state.logs, todayKey));
  const yesterdayTotal = round1(dayTotal(state.logs, yesterdayKey));
  const deltaPct =
    yesterdayTotal > 0 ? Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100) : 0;

  const weekTotals = week.map((key) => ({ key, total: round1(dayTotal(state.logs, key)) }));
  const weekLogs = state.logs.filter((l) => week.includes(l.date));
  const weekBreakdown = breakdown(weekLogs);
  const todayBreakdown = breakdown(todayLogs);

  const donePlan = state.plan.filter((p) => p.done);
  const planSaved = donePlan.reduce(
    (s, p) => s + (ACTIONS.find((a) => a.id === p.templateId)?.saving ?? 0),
    0,
  );
  const totalSaved = round1(state.stats.savedBaseline + planSaved);
  const completedCount = state.stats.actionsBaseline + donePlan.length;

  const biggestSource = computeBiggestSource(weekBreakdown);
  const plan = buildPlanRows(state);

  return {
    hydrated,
    bootstrapped,
    profile: state.profile,
    logs: state.logs,
    plan,
    todayKey,
    todayLogs,
    todayTotal,
    yesterdayTotal,
    deltaPct,
    todayBreakdown,
    weekTotals,
    weekBreakdown,
    streak: computeStreak(state.logs),
    totalSaved,
    completedCount,
    biggestSource,
    ...actions,
  };
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Returns the ISO date keys for the last 7 days, oldest first. */
export function getWeekDays(): string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return dayKey(d);
  });
}

/** Finds the highest-emitting category over the supplied breakdown map. */
export function computeBiggestSource(
  weekBreakdown: Record<Category, number>,
): { category: Category; value: number } | null {
  let biggest: { category: Category; value: number } | null = null;
  for (const [cat, val] of Object.entries(weekBreakdown) as [Category, number][]) {
    if (val > 0 && (!biggest || val > biggest.value)) {
      biggest = { category: cat, value: round1(val) };
    }
  }
  return biggest;
}

/** Joins plan items with their ActionTemplate data for rendering. */
export function buildPlanRows(state: PersistedState): PlanRow[] {
  return state.plan
    .map((p) => {
      const template = ACTIONS.find((a) => a.id === p.templateId);
      return template ? { ...p, template } : null;
    })
    .filter((p): p is PlanRow => p !== null);
}

// ─── SSR default context ──────────────────────────────────────────────────────

const EMPTY_BREAKDOWN: Record<Category, number> = {
  travel: 0,
  food: 0,
  electricity: 0,
  shopping: 0,
  waste: 0,
};

/**
 * Safe placeholder used only during server rendering / static generation.
 * The client-only provider is always present in the browser.
 */
export const SSR_DEFAULT_CTX: CarbonCtxValue = {
  hydrated: false,
  bootstrapped: false,
  profile: {
    name: '',
    onboarded: false,
    travelMode: '',
    dailyDistance: 0,
    diet: '',
    electricity: '',
    shopping: '',
    weeklyGoalPct: 15,
  },
  logs: [],
  plan: [],
  todayKey: dayKey(),
  todayLogs: [],
  todayTotal: 0,
  yesterdayTotal: 0,
  deltaPct: 0,
  todayBreakdown: { ...EMPTY_BREAKDOWN },
  weekTotals: [],
  weekBreakdown: { ...EMPTY_BREAKDOWN },
  streak: 0,
  totalSaved: 0,
  completedCount: 0,
  biggestSource: null,
  addLog: async () => {},
  removeLog: async () => {},
  addPlan: () => {},
  removePlan: () => {},
  togglePlan: async () => {},
  saveProfile: async () => {},
  completeOnboarding: async () => {},
  resetAll: () => {},
};
