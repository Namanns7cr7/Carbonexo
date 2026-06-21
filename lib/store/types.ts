/**
 * Carbonexo store — shared types and interfaces.
 *
 * Kept separate from the provider so that other modules can import types
 * without pulling in React context or side-effect code.
 */
import type { ReactNode } from 'react';
import type { Category, LogEntry, Profile } from '@/lib/carbon';
import type { ActionTemplate } from '@/lib/carbon';

// ─── Persisted state shape ────────────────────────────────────────────────────

export interface PlanItem {
  templateId: string;
  addedAt: number;
  done: boolean;
}

/** State that is persisted to localStorage. */
export interface PersistedState {
  version: number;
  profile: Profile;
  logs: LogEntry[];
  plan: PlanItem[];
  stats: {
    savedBaseline: number;
    actionsBaseline: number;
  };
}

// ─── Reducer actions ──────────────────────────────────────────────────────────

export type StoreAction =
  | { type: 'hydrate'; state: PersistedState }
  | { type: 'addLog'; log: LogEntry }
  | { type: 'removeLog'; id: string }
  | { type: 'addPlan'; templateId: string }
  | { type: 'removePlan'; templateId: string }
  | { type: 'togglePlan'; templateId: string }
  | { type: 'saveProfile'; patch: Partial<Profile> }
  | { type: 'completeOnboarding' }
  | { type: 'reset' };

// ─── Context shape ────────────────────────────────────────────────────────────

/** A plan row enriched with its ActionTemplate for rendering. */
export interface PlanRow extends PlanItem {
  template: ActionTemplate;
}

/** The full shape exposed by `useCarbon()`. */
export interface CarbonCtxValue {
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
  /** Negative = improvement versus yesterday. */
  deltaPct: number;
  todayBreakdown: Record<Category, number>;
  weekTotals: { key: string; total: number }[];
  weekBreakdown: Record<Category, number>;
  streak: number;
  totalSaved: number;
  completedCount: number;
  biggestSource: { category: Category; value: number } | null;

  // actions
  addLog: (log: Omit<LogEntry, 'id' | 'createdAt'>) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
  addPlan: (templateId: string) => void;
  removePlan: (templateId: string) => void;
  togglePlan: (templateId: string) => Promise<void>;
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  resetAll: () => void;
}

// ─── Provider props ───────────────────────────────────────────────────────────

export interface CarbonexoProviderProps {
  children: ReactNode;
}
