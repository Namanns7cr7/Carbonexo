'use client';

/* ============================================================
   Carbonexo — client data layer.
   Context + reducer over { profile, logs, plan, stats },
   persisted to localStorage. Seeds realistic sample data on
   first run so every screen matches the design numbers
   (today 6.8 kg · ↓12% · 5-day streak · 42 kg saved).
   Pure selectors live alongside the provider.
   ============================================================ */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import {
  ACTIONS,
  breakdown,
  dayKey,
  dayTotal,
  lastNDays,
  round1,
  type ActionTemplate,
  type Category,
  type LogEntry,
  type Profile,
} from './carbon';
import { isAuthenticated } from './api/auth';
import { getProfile, updateProfile, completeOnboarding as apiCompleteOnboarding } from './api/profile';
import { getDashboard } from './api/dashboard';
import { createActivity, deleteActivity } from './api/activities';
import { completeAction } from './api/credits';

const STORAGE_KEY = 'cx-state';
const VERSION = 1;

export interface PlanItem {
  templateId: string;
  addedAt: number;
  done: boolean;
}

interface State {
  version: number;
  profile: Profile;
  logs: LogEntry[];
  plan: PlanItem[];
  stats: { savedBaseline: number; actionsBaseline: number };
}

/* ---------------- seed ---------------- */

let seq = 0;
const uid = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function mk(category: Category, label: string, emoji: string, co2: number, date: string, note?: string): LogEntry {
  return { id: uid(), category, label, emoji, co2: round1(co2), note, date, createdAt: Date.now() };
}

function seed(): State {
  const days = lastNDays(7); // oldest → newest; [6]=today, [5]=yesterday ...
  const today = days[6];
  const logs: LogEntry[] = [
    // today → travel 3.1 / food 1.9 / electricity 1.8 = 6.8
    mk('travel', 'Car commute', '🚗', 2.4, today, '13 km'),
    mk('travel', 'Metro ride', '🚇', 0.7, today, '17 km'),
    mk('food', 'Chicken lunch', '🍗', 1.2, today, '1 meal'),
    mk('food', 'Veg dinner', '🥗', 0.7, today, '1 meal'),
    mk('electricity', 'Home electricity', '⚡', 1.8, today, '4 kWh'),
  ];
  // previous days drive the weekly chart + 5-day streak (days -5,-6 stay empty)
  const prior: Record<string, number> = { [days[5]]: 7.7, [days[4]]: 9.1, [days[3]]: 7.2, [days[2]]: 8.4 };
  for (const [date, total] of Object.entries(prior)) {
    logs.push(mk('travel', 'Car commute', '🚗', total * 0.46, date, 'commute'));
    logs.push(mk('food', 'Mixed meals', '🍽️', total * 0.28, date, 'meals'));
    logs.push(mk('electricity', 'Home electricity', '⚡', total * 0.26, date, 'kWh'));
  }
  return {
    version: VERSION,
    profile: {
      name: 'You',
      onboarded: false,
      travelMode: 'Car',
      dailyDistance: 18,
      diet: 'Mixed',
      electricity: 'Medium',
      shopping: 'Sometimes',
      weeklyGoalPct: 15,
    },
    logs,
    plan: [],
    stats: { savedBaseline: 42, actionsBaseline: 18 },
  };
}

/* ---------------- reducer ---------------- */

type Action =
  | { type: 'hydrate'; state: State }
  | { type: 'addLog'; log: LogEntry }
  | { type: 'removeLog'; id: string }
  | { type: 'addPlan'; templateId: string }
  | { type: 'removePlan'; templateId: string }
  | { type: 'togglePlan'; templateId: string }
  | { type: 'saveProfile'; patch: Partial<Profile> }
  | { type: 'completeOnboarding' }
  | { type: 'reset' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'addLog':
      return { ...state, logs: [action.log, ...state.logs] };
    case 'removeLog':
      return { ...state, logs: state.logs.filter((l) => l.id !== action.id) };
    case 'addPlan':
      if (state.plan.some((p) => p.templateId === action.templateId)) return state;
      return { ...state, plan: [...state.plan, { templateId: action.templateId, addedAt: Date.now(), done: false }] };
    case 'removePlan':
      return { ...state, plan: state.plan.filter((p) => p.templateId !== action.templateId) };
    case 'togglePlan':
      return {
        ...state,
        plan: state.plan.map((p) => (p.templateId === action.templateId ? { ...p, done: !p.done } : p)),
      };
    case 'saveProfile':
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case 'completeOnboarding':
      return { ...state, profile: { ...state.profile, onboarded: true } };
    case 'reset':
      return seed();
    default:
      return state;
  }
}

/* ---------------- context ---------------- */

export interface PlanRow extends PlanItem {
  template: ActionTemplate;
}

interface Ctx {
  hydrated: boolean;
  bootstrapped: boolean;
  profile: Profile;
  logs: LogEntry[];
  plan: PlanRow[];
  // derived
  todayKey: string;
  todayLogs: LogEntry[];
  todayTotal: number;
  yesterdayTotal: number;
  deltaPct: number; // negative = improvement vs yesterday
  todayBreakdown: Record<Category, number>;
  weekTotals: { key: string; total: number }[];
  weekBreakdown: Record<Category, number>;
  streak: number;
  totalSaved: number;
  completedCount: number;
  biggestSource: { category: Category; value: number } | null;
  // actions
  addLog: (log: Omit<LogEntry, 'id' | 'createdAt'>) => void;
  removeLog: (id: string) => void;
  addPlan: (templateId: string) => void;
  removePlan: (templateId: string) => void;
  togglePlan: (templateId: string) => void;
  saveProfile: (patch: Partial<Profile>) => void;
  completeOnboarding: () => void;
  resetAll: () => void;
}

const CarbonCtx = createContext<Ctx | null>(null);

function computeStreak(logs: LogEntry[]): number {
  const have = new Set(logs.map((l) => l.date));
  let n = 0;
  const today = new Date();
  for (;;) {
    const k = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));
    if (have.has(k)) n++;
    else break;
  }
  return n;
}

export function CarbonexoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined as unknown as State, seed);
  const [hydrated, setHydrated] = useState(false);
  const [apiData, setApiData] = useState<{
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
  } | null>(null);

  const [isAuthed, setIsAuthed] = useState(false);
  // true once the first server fetch attempt has finished — so the onboarding
  // gate waits for the real (server) onboarded flag instead of the stale seed.
  const [bootstrapped, setBootstrapped] = useState(false);

  const refreshApi = async () => {
    const isUserAuthed = isAuthenticated();
    setIsAuthed(isUserAuthed);
    if (!isUserAuthed) {
      setApiData(null);
      return;
    }
    try {
      const [prof, dash] = await Promise.all([getProfile(), getDashboard()]);
      
      const localProfile: Profile = {
        name: prof.name || 'User',
        onboarded: prof.onboarded,
        travelMode: prof.travelMode || 'Car',
        dailyDistance: prof.dailyDistanceKm || 0,
        diet: prof.diet || 'Mixed',
        electricity: prof.electricityUsage || 'Medium',
        shopping: prof.shoppingHabit || 'Sometimes',
        weeklyGoalPct: prof.weeklyGoalPct || 15,
      };

      const week = lastNDays(7);
      const todayK = week[6];

      const todayLogsMapped: LogEntry[] = (dash.todayLogs || []).map((l: any) => ({
        id: l.id,
        category: (l.category?.toLowerCase() || 'travel') as Category,
        label: l.label,
        emoji: l.emoji || '🌱',
        co2: l.co2Kg,
        note: l.note,
        date: todayK,
        createdAt: Date.now(),
      }));

      const todayBreakdownMapped: Record<Category, number> = {
        travel: dash.todayBreakdown?.travel || 0,
        food: dash.todayBreakdown?.food || 0,
        electricity: dash.todayBreakdown?.electricity || 0,
        shopping: dash.todayBreakdown?.shopping || 0,
        waste: dash.todayBreakdown?.waste || 0,
      };

      const weekBreakdownMapped: Record<Category, number> = {
        travel: dash.weekBreakdown?.travel || 0,
        food: dash.weekBreakdown?.food || 0,
        electricity: dash.weekBreakdown?.electricity || 0,
        shopping: dash.weekBreakdown?.shopping || 0,
        waste: dash.weekBreakdown?.waste || 0,
      };

      const weekTotalsMapped = (dash.weekTotals || []).map((t: any) => ({
        key: t.date,
        total: t.total,
      }));

      const biggestSourceMapped = dash.biggestCategory
        ? { category: (dash.biggestCategory?.toLowerCase() || 'travel') as Category, value: dash.biggestValue }
        : null;

      setApiData({
        profile: localProfile,
        logs: [],
        todayLogs: todayLogsMapped,
        todayTotal: dash.todayTotal,
        yesterdayTotal: dash.yesterdayTotal,
        deltaPct: dash.deltaPct,
        todayBreakdown: todayBreakdownMapped,
        weekTotals: weekTotalsMapped,
        weekBreakdown: weekBreakdownMapped,
        streak: dash.streak,
        totalSaved: dash.totalSaved,
        completedCount: 0,
        biggestSource: biggestSourceMapped,
      });
    } catch (err) {
      console.error('Failed to load api data in store', err);
    } finally {
      setBootstrapped(true);
    }
  };

  // load from storage (or keep seed) after mount — avoids SSR/client mismatch
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        if (parsed && parsed.version === VERSION) dispatch({ type: 'hydrate', state: parsed });
      }
    } catch {
      /* ignore corrupt storage — keep seed */
    }
    setHydrated(true);
  }, []);

  // Sync auth and fetch API data once hydrated
  useEffect(() => {
    if (hydrated) {
      refreshApi();
    }
  }, [hydrated]);

  // persist
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [state, hydrated]);

  const addLog = async (log: Omit<LogEntry, 'id' | 'createdAt'>) => {
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
        console.error(err);
      }
    } else {
      dispatch({ type: 'addLog', log: { ...log, id: uid(), createdAt: Date.now() } });
    }
  };

  const removeLog = async (id: string) => {
    if (isAuthenticated()) {
      try {
        await deleteActivity(id);
        await refreshApi();
      } catch (err) {
        console.error(err);
      }
    } else {
      dispatch({ type: 'removeLog', id });
    }
  };

  const saveProfile = async (patch: Partial<Profile>) => {
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
        console.error(err);
      }
    } else {
      dispatch({ type: 'saveProfile', patch });
    }
  };

  const completeOnboarding = async () => {
    if (isAuthenticated()) {
      try {
        await apiCompleteOnboarding();
        await refreshApi();
      } catch (err) {
        console.error(err);
      }
    } else {
      dispatch({ type: 'completeOnboarding' });
    }
  };

  const togglePlan = async (templateId: string) => {
    dispatch({ type: 'togglePlan', templateId });
    if (isAuthenticated()) {
      const currentItem = state.plan.find((p) => p.templateId === templateId);
      if (currentItem && !currentItem.done) {
        try {
          await completeAction(templateId);
          await refreshApi();
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  const value = useMemo<Ctx>(() => {
    const week = lastNDays(7);
    const todayKey = week[6];
    const yKey = week[5];
    const todayLogs = state.logs.filter((l) => l.date === todayKey);
    const todayTotal = round1(dayTotal(state.logs, todayKey));
    const yesterdayTotal = round1(dayTotal(state.logs, yKey));
    const deltaPct = yesterdayTotal > 0 ? Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100) : 0;
    const weekTotals = week.map((key) => ({ key, total: round1(dayTotal(state.logs, key)) }));
    const weekLogs = state.logs.filter((l) => week.includes(l.date));
    const weekBreakdown = breakdown(weekLogs);
    const todayBreakdown = breakdown(todayLogs);

    const done = state.plan.filter((p) => p.done);
    const planSaved = done.reduce((s, p) => s + (ACTIONS.find((a) => a.id === p.templateId)?.saving ?? 0), 0);
    const totalSaved = round1(state.stats.savedBaseline + planSaved);
    const completedCount = state.stats.actionsBaseline + done.length;

    let biggestSource: { category: Category; value: number } | null = null;
    for (const [cat, val] of Object.entries(weekBreakdown) as [Category, number][]) {
      if (val > 0 && (!biggestSource || val > biggestSource.value)) biggestSource = { category: cat, value: round1(val) };
    }

    const plan: PlanRow[] = state.plan
      .map((p) => {
        const template = ACTIONS.find((a) => a.id === p.templateId);
        return template ? { ...p, template } : null;
      })
      .filter(Boolean) as PlanRow[];

    if (apiData) {
      return {
        hydrated,
        bootstrapped,
        profile: apiData.profile,
        logs: apiData.logs,
        plan,
        todayKey,
        todayLogs: apiData.todayLogs,
        todayTotal: apiData.todayTotal,
        yesterdayTotal: apiData.yesterdayTotal,
        deltaPct: apiData.deltaPct,
        todayBreakdown: apiData.todayBreakdown,
        weekTotals: apiData.weekTotals,
        weekBreakdown: apiData.weekBreakdown,
        streak: apiData.streak,
        totalSaved: apiData.totalSaved,
        completedCount: apiData.completedCount,
        biggestSource: apiData.biggestSource,
        addLog,
        removeLog,
        addPlan: (templateId) => dispatch({ type: 'addPlan', templateId }),
        removePlan: (templateId) => dispatch({ type: 'removePlan', templateId }),
        togglePlan,
        saveProfile,
        completeOnboarding,
        resetAll: () => {
          dispatch({ type: 'reset' });
          setApiData(null);
        },
      };
    }

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
      addLog,
      removeLog,
      addPlan: (templateId) => dispatch({ type: 'addPlan', templateId }),
      removePlan: (templateId) => dispatch({ type: 'removePlan', templateId }),
      togglePlan,
      saveProfile,
      completeOnboarding,
      resetAll: () => dispatch({ type: 'reset' }),
    };
  }, [state, hydrated, apiData, bootstrapped]);

  return <CarbonCtx.Provider value={value}>{children}</CarbonCtx.Provider>;
}

export function useCarbon(): Ctx {
  const ctx = useContext(CarbonCtx);
  if (!ctx) throw new Error('useCarbon must be used within CarbonexoProvider');
  return ctx;
}
