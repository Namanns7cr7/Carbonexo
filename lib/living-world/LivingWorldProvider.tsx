'use client';

/**
 * The Living World provider — mounted once in the app shell, read by every
 * screen. It owns no business logic: it gathers data that already exists
 * (the Carbonexo store, the activity API, the credit ledger) and hands it to
 * the pure engine in ./derive.
 *
 *   Activity API ──► 14-day history ─┐
 *   Store (dashboard, profile, plan) ┼──► buildLivingWorld() ──► LivingWorldState ──► <LivingEarth vitality>
 *   Credit ledger ──► LedgerFacts ───┤
 *   Simulation API ──► scenario ─────┘   (hypothetical; never enters `actual`)
 *
 * Refetches are keyed on the store's own aggregates, so a logged activity
 * (store → POST → refreshApi) flows through here without extra wiring.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCarbon } from '../store';
import { isAuthenticated } from '../api/auth';
import { getActivities } from '../api/activities';
import { getBalance, getHistory } from '../api/credits';
import { dayKey } from '../carbon';
import { buildDays, buildLivingWorld, ledgerFacts, type ScenarioInput } from './derive';
import type { LedgerFacts, LivingWorldState } from './types';

export type PulseKind = 'log' | 'remove' | 'action' | 'milestone' | 'scenario';

export interface LivingWorldCtx {
  world: LivingWorldState;
  /** True until the first history fetch settles (signed in only). */
  loading: boolean;
  /** Last fetch failed; the world falls back to the store's 7-day data. */
  stale: boolean;
  /** Increments on every user action worth physical feedback. */
  pulse: { n: number; kind: PulseKind | null };
  emitPulse: (kind: PulseKind) => void;
  setScenario: (s: ScenarioInput | null) => void;
  /** Re-read the ledger (e.g. after an action completes). */
  refreshLedger: () => void;
}

const Ctx = createContext<LivingWorldCtx | null>(null);

export function LivingWorldProvider({ children }: { children: ReactNode }) {
  const carbon = useCarbon();
  const [authed, setAuthed] = useState(false);
  const [history, setHistory] = useState<{ date: string; kg: number }[] | null>(null);
  const [ledger, setLedger] = useState<LedgerFacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [scenario, setScenario] = useState<ScenarioInput | null>(null);
  const [pulse, setPulse] = useState<{ n: number; kind: PulseKind | null }>({ n: 0, kind: null });
  const [ledgerTick, setLedgerTick] = useState(0);

  useEffect(() => setAuthed(isAuthenticated()), []);

  // ── 14-day history, refetched whenever the store's aggregates move ─────────
  const historyKey = `${carbon.todayTotal}|${carbon.todayLogs.length}|${carbon.weekTotals.map((d) => d.total).join(',')}`;
  useEffect(() => {
    if (!authed || !carbon.bootstrapped) return;
    let cancelled = false;
    const today = new Date();
    const from = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13));
    getActivities(from, dayKey(today))
      .then((rows) => {
        if (cancelled) return;
        setHistory(rows.map((r) => ({ date: r.activityDate, kg: r.co2Kg })));
        setStale(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[LivingWorld] history unavailable; using the 7-day dashboard aggregates', err);
        setStale(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [authed, carbon.bootstrapped, historyKey]);

  // ── Ledger: persisted milestones (actions, bills) and the real balance ─────
  const doneCount = carbon.plan.filter((p) => p.done).length;
  useEffect(() => {
    if (!authed || !carbon.bootstrapped) return;
    let cancelled = false;
    Promise.all([getHistory(), getBalance()])
      .then(([h, b]) => !cancelled && setLedger(ledgerFacts(h, b.balance)))
      .catch((err) => console.warn('[LivingWorld] ledger unavailable', err));
    return () => {
      cancelled = true;
    };
  }, [authed, carbon.bootstrapped, doneCount, ledgerTick]);

  // ── Assemble ───────────────────────────────────────────────────────────────
  const world = useMemo<LivingWorldState>(() => {
    // Signed in: the API history. If it failed, the dashboard's 7-day totals
    // (a day with 0 kg reads as unlogged there, which only lowers confidence).
    // Signed out: the local example store, labelled as an example.
    let entries: { date: string; kg: number }[];
    if (authed) {
      entries = history ?? carbon.weekTotals.filter((d) => d.total > 0).map((d) => ({ date: d.key, kg: d.total }));
    } else {
      entries = carbon.logs.map((l) => ({ date: l.date, kg: l.co2 }));
    }
    return buildLivingWorld({
      actual: { provenance: authed ? 'logged' : 'example', days: buildDays(entries), weekBreakdown: carbon.weekBreakdown, streak: carbon.streak },
      goal: { weeklyGoalPct: carbon.profile.weeklyGoalPct || 15, plan: carbon.plan.map((p) => ({ templateId: p.templateId, done: p.done })) },
      ledger,
      scenario,
    });
  }, [authed, history, carbon.weekTotals, carbon.logs, carbon.weekBreakdown, carbon.streak, carbon.profile.weeklyGoalPct, carbon.plan, ledger, scenario]);

  // A milestone newly reached since the last render is itself a pulse.
  const reached = useRef<Set<string> | null>(null);
  useEffect(() => {
    const now = new Set(world.milestones.filter((m) => m.reached).map((m) => m.id));
    if (reached.current) {
      const fresh = Array.from(now).some((id) => !reached.current!.has(id));
      if (fresh) setPulse((p) => ({ n: p.n + 1, kind: 'milestone' }));
    }
    // Only start comparing once real data has loaded, so first paint never "celebrates".
    if (!loading || !authed) reached.current = now;
  }, [world.milestones, loading, authed]);

  const emitPulse = useCallback((kind: PulseKind) => setPulse((p) => ({ n: p.n + 1, kind })), []);
  const refreshLedger = useCallback(() => setLedgerTick((t) => t + 1), []);

  const value = useMemo<LivingWorldCtx>(
    () => ({ world, loading: authed ? loading : false, stale, pulse, emitPulse, setScenario, refreshLedger }),
    [world, authed, loading, stale, pulse, emitPulse, refreshLedger]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The shared Living World. Outside the provider (e.g. the landing page) this throws on purpose: those pages use the story channel instead. */
export function useLivingWorld(): LivingWorldCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLivingWorld must be used inside <LivingWorldProvider> (the /app shell).');
  return ctx;
}

/** Same, but returns null outside the provider — for components shared with public pages. */
export function useOptionalLivingWorld(): LivingWorldCtx | null {
  return useContext(Ctx);
}
