'use client';

/**
 * Carbonexo — client data layer.
 *
 * This module is intentionally thin: it wires together the reducer, seed,
 * and selector helpers that live in their own focused files. Business logic
 * should live in those files, not here.
 *
 * Architecture overview:
 *   lib/store/types.ts     — shared TypeScript interfaces
 *   lib/store/seed.ts      — initial state builder
 *   lib/store/reducer.ts   — pure state reducer
 *   lib/store/selectors.ts — derived-value helpers + SSR placeholder
 *   lib/store.tsx          — React context provider + useCarbon hook (this file)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import type { Category, LogEntry, Profile } from './carbon';
import { isAuthenticated } from './api/auth';
import { getProfile, updateProfile, completeOnboarding as apiCompleteOnboarding } from './api/profile';
import { getDashboard } from './api/dashboard';
import { createActivity, deleteActivity } from './api/activities';
import { completeAction } from './api/credits';
import { STATE_STORAGE_KEY, STATE_VERSION } from './constants';
import { buildSeedState, generateLocalId } from './store/seed';
import { reducer } from './store/reducer';
import {
  buildLocalContextValue,
  buildPlanRows,
  computeBiggestSource,
  getWeekDays,
  SSR_DEFAULT_CTX,
} from './store/selectors';
import type { CarbonCtxValue, CarbonexoProviderProps, PersistedState } from './store/types';

// Re-export types that downstream consumers import from '@/lib/store'
export type { PlanItem, PlanRow, CarbonCtxValue } from './store/types';

// ─── Context ──────────────────────────────────────────────────────────────────

const CarbonCtx = createContext<CarbonCtxValue | null>(null);

// ─── API data shape (server-fetched snapshot) ─────────────────────────────────

interface ApiSnapshot {
  profile: Profile;
  logs: LogEntry[];
  todayLogs: LogEntry[];
  todayTotal: number;
  yesterdayTotal: number;
  deltaPct: number;
  todayBreakdown: Record<Category, number>;
  weekTotals: { key: string; total: number }[];
  weekBreakdown: Record<Category, number>;
  streak: number;
  totalSaved: number;
  completedCount: number;
  biggestSource: { category: Category; value: number } | null;
}

// ─── API → local model mapping ────────────────────────────────────────────────

/** Maps the raw API response from /api/dashboard + /api/profiles/me into an ApiSnapshot. */
async function fetchApiSnapshot(): Promise<ApiSnapshot | null> {
  if (!isAuthenticated()) return null;

  const [prof, dash] = await Promise.all([getProfile(), getDashboard()]);

  const week = getWeekDays();
  const todayKey = week[6];

  const mappedProfile: Profile = {
    name: prof.name || 'User',
    onboarded: prof.onboarded,
    travelMode: prof.travelMode || 'Car',
    dailyDistance: prof.dailyDistanceKm || 0,
    diet: prof.diet || 'Mixed',
    electricity: prof.electricityUsage || 'Medium',
    shopping: prof.shoppingHabit || 'Sometimes',
    weeklyGoalPct: prof.weeklyGoalPct || 15,
  };

  const mappedTodayLogs: LogEntry[] = (dash.todayLogs ?? []).map((l) => ({
    id: l.id,
    category: (l.category?.toLowerCase() || 'travel') as Category,
    label: l.label,
    emoji: l.emoji || '🌱',
    co2: l.co2Kg,
    note: l.note,
    date: todayKey,
    createdAt: Date.now(),
  }));

  const emptyBreakdown: Record<Category, number> = {
    travel: 0, food: 0, electricity: 0, shopping: 0, waste: 0,
  };

  const mappedTodayBreakdown: Record<Category, number> = {
    travel: dash.todayBreakdown?.travel ?? 0,
    food: dash.todayBreakdown?.food ?? 0,
    electricity: dash.todayBreakdown?.electricity ?? 0,
    shopping: dash.todayBreakdown?.shopping ?? 0,
    waste: dash.todayBreakdown?.waste ?? 0,
  };

  const mappedWeekBreakdown: Record<Category, number> = {
    travel: dash.weekBreakdown?.travel ?? 0,
    food: dash.weekBreakdown?.food ?? 0,
    electricity: dash.weekBreakdown?.electricity ?? 0,
    shopping: dash.weekBreakdown?.shopping ?? 0,
    waste: dash.weekBreakdown?.waste ?? 0,
  };

  const biggestSource = dash.biggestCategory
    ? { category: (dash.biggestCategory.toLowerCase() || 'travel') as Category, value: dash.biggestValue }
    : null;

  return {
    profile: mappedProfile,
    logs: [],
    todayLogs: mappedTodayLogs,
    todayTotal: dash.todayTotal,
    yesterdayTotal: dash.yesterdayTotal,
    deltaPct: dash.deltaPct,
    todayBreakdown: mappedTodayBreakdown,
    weekTotals: (dash.weekTotals ?? []).map((t) => ({ key: t.date, total: t.total })),
    weekBreakdown: mappedWeekBreakdown,
    streak: dash.streak,
    totalSaved: dash.totalSaved,
    completedCount: 0,
    biggestSource,
  };

  void emptyBreakdown; // referenced by type only above
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CarbonexoProvider({ children }: CarbonexoProviderProps) {
  const [state, dispatch] = useReducer(reducer, undefined as unknown as PersistedState, buildSeedState);
  const [hydrated, setHydrated] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [apiSnapshot, setApiSnapshot] = useState<ApiSnapshot | null>(null);

  // ── Fetch (or refresh) server data ──────────────────────────────────────────
  const refreshApi = useCallback(async () => {
    try {
      const snapshot = await fetchApiSnapshot();
      setApiSnapshot(snapshot);
    } catch (err) {
      console.error('[Carbonexo] Failed to load server data:', err);
    } finally {
      setBootstrapped(true);
    }
  }, []);

  // ── Hydrate from localStorage after mount (avoids SSR mismatch) ─────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STATE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        if (parsed?.version === STATE_VERSION) {
          dispatch({ type: 'hydrate', state: parsed });
        }
      }
    } catch {
      // Ignore corrupt or missing storage — keep the seed state.
    }
    setHydrated(true);
  }, []);

  // ── Fetch server data once hydrated ────────────────────────────────────────
  useEffect(() => {
    if (hydrated) refreshApi();
  }, [hydrated, refreshApi]);

  // ── Persist state to localStorage ─────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or unavailable — non-fatal.
    }
  }, [state, hydrated]);

  // ── Action handlers ────────────────────────────────────────────────────────

  const addLog = useCallback(async (log: Omit<LogEntry, 'id' | 'createdAt'>) => {
    if (isAuthenticated()) {
      try {
        await createActivity({
          category: log.category,
          label: log.label,
          emoji: log.emoji,
          quantity: log.note ? parseFloat(log.note) : undefined,
          co2Kg: log.co2,
          note: log.note,
          activityDate: log.date,
        });
        await refreshApi();
      } catch (err) {
        console.error('[Carbonexo] addLog failed:', err);
      }
    } else {
      dispatch({ type: 'addLog', log: { ...log, id: generateLocalId(), createdAt: Date.now() } });
    }
  }, [refreshApi]);

  const removeLog = useCallback(async (id: string) => {
    if (isAuthenticated()) {
      try {
        await deleteActivity(id);
        await refreshApi();
      } catch (err) {
        console.error('[Carbonexo] removeLog failed:', err);
      }
    } else {
      dispatch({ type: 'removeLog', id });
    }
  }, [refreshApi]);

  const saveProfile = useCallback(async (patch: Partial<Profile>) => {
    if (isAuthenticated()) {
      try {
        await updateProfile({
          name: patch.name,
          travelMode: patch.travelMode,
          dailyDistanceKm: patch.dailyDistance,
          diet: patch.diet,
          electricityUsage: patch.electricity,
          shoppingHabit: patch.shopping,
          weeklyGoalPct: patch.weeklyGoalPct,
        });
        await refreshApi();
      } catch (err) {
        console.error('[Carbonexo] saveProfile failed:', err);
      }
    } else {
      dispatch({ type: 'saveProfile', patch });
    }
  }, [refreshApi]);

  const completeOnboarding = useCallback(async () => {
    if (isAuthenticated()) {
      try {
        await apiCompleteOnboarding();
        await refreshApi();
      } catch (err) {
        console.error('[Carbonexo] completeOnboarding failed:', err);
      }
    } else {
      dispatch({ type: 'completeOnboarding' });
    }
  }, [refreshApi]);

  const togglePlan = useCallback(async (templateId: string) => {
    dispatch({ type: 'togglePlan', templateId });
    if (isAuthenticated()) {
      const currentItem = state.plan.find((p) => p.templateId === templateId);
      if (currentItem && !currentItem.done) {
        try {
          await completeAction(templateId);
          await refreshApi();
        } catch (err) {
          console.error('[Carbonexo] togglePlan failed:', err);
        }
      }
    }
  }, [state.plan, refreshApi]);

  const addPlan = useCallback(
    (templateId: string) => dispatch({ type: 'addPlan', templateId }),
    [],
  );

  const removePlan = useCallback(
    (templateId: string) => dispatch({ type: 'removePlan', templateId }),
    [],
  );

  const resetAll = useCallback(() => {
    dispatch({ type: 'hydrate', state: buildSeedState() });
    setApiSnapshot(null);
  }, []);

  // ── Shared action bag ──────────────────────────────────────────────────────

  const actionBag = useMemo(
    () => ({ addLog, removeLog, addPlan, removePlan, togglePlan, saveProfile, completeOnboarding, resetAll }),
    [addLog, removeLog, addPlan, removePlan, togglePlan, saveProfile, completeOnboarding, resetAll],
  );

  // ── Derive context value ───────────────────────────────────────────────────

  const value = useMemo<CarbonCtxValue>(() => {
    // During SSR / before mount: return a stable, data-free context so the
    // server HTML and first client render match exactly. Real data flows in
    // once `hydrated` flips true in the mount effect.
    if (!hydrated) {
      return { ...SSR_DEFAULT_CTX, ...actionBag };
    }

    const plan = buildPlanRows(state);
    const week = getWeekDays();

    if (apiSnapshot) {
      // Authenticated path: use server data for all derived values.
      return {
        hydrated,
        bootstrapped,
        profile: apiSnapshot.profile,
        logs: apiSnapshot.logs,
        plan,
        todayKey: week[6],
        todayLogs: apiSnapshot.todayLogs,
        todayTotal: apiSnapshot.todayTotal,
        yesterdayTotal: apiSnapshot.yesterdayTotal,
        deltaPct: apiSnapshot.deltaPct,
        todayBreakdown: apiSnapshot.todayBreakdown,
        weekTotals: apiSnapshot.weekTotals,
        weekBreakdown: apiSnapshot.weekBreakdown,
        streak: apiSnapshot.streak,
        totalSaved: apiSnapshot.totalSaved,
        completedCount: apiSnapshot.completedCount,
        biggestSource: apiSnapshot.biggestSource,
        ...actionBag,
      };
    }

    // Unauthenticated / offline path: derive everything from local state.
    return buildLocalContextValue(state, hydrated, bootstrapped, actionBag);
  }, [state, hydrated, bootstrapped, apiSnapshot, actionBag]);

  return <CarbonCtx.Provider value={value}>{children}</CarbonCtx.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the Carbonexo context value.
 *
 * The provider is mounted at the app root, so a null context only happens
 * during SSR / static generation. We return a safe default rather than
 * throwing — a missing context must never crash the client into a white screen.
 */
export function useCarbon(): CarbonCtxValue {
  const ctx = useContext(CarbonCtx);
  return ctx ?? SSR_DEFAULT_CTX;
}
