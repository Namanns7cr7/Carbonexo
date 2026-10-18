'use client';

/**
 * Dashboard — the existing analytics screen, on the Living World.
 *
 * Same sections as before (hero KPIs, emissions core, weekly trajectory,
 * hotspots, activity ledger, advisor, swaps, quick logger, rewards). What
 * changed is where the numbers come from:
 *  - every figure is the user's logged data, a sourced reference, or a
 *    catalog estimate — and says which;
 *  - the hero's photograph is the user's own planet (shared Living World);
 *  - logging, planning and milestones give physical feedback through it.
 * Removed: the fixed 8 kg/day "CO₂ avoided", the invented peer benchmark,
 * the 0–100 "eco score", the "1.5x multiplier", hardcoded credits and swaps
 * that promised credits they never awarded.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Flame, TrendingUp, TrendingDown, Minus, Plus, ChevronRight, Clock, ArrowRight, Trash2, Check, Globe2, BarChart3, FileText, Coins, FlaskConical, ListPlus } from 'lucide-react';
import { useCarbon } from '@/lib/store';
import { ACTIONS, CATEGORY_META, TRACK_OPTIONS, round1, type Category, type TrackOption } from '@/lib/carbon';
import { logMetaFor } from '@/lib/catalog-keys';
import { getRewards, type RewardData } from '@/lib/api/rewards';
import { useLivingWorld } from '@/lib/living-world/LivingWorldProvider';
import { LIFESTYLE_BUDGET_KG_PER_DAY, LIFESTYLE_BUDGET_SOURCE } from '@/lib/living-world/derive';
import { Card } from '@/components/app/ui';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScoreRing, WeeklyChart, CategoryBars } from '@/components/app/charts';
import { SproutIllustration, CategoryIcon } from '@/components/app/illustrations';
import { PlanetPanel } from '@/components/living-world/PlanetPanel';
import { ProvenanceBadge } from '@/components/living-world/Provenance';
import { Celebrate, TactileCard, UI_SPRING } from '@/components/physics';
import { useRegisterPageContext } from '@/lib/context/ecomind-context';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Quick logs straight from the Track catalog, at its default quantity — same factors, same kg. */
const QUICK: { category: Category; label: string }[] = [
  { category: 'travel', label: 'Car ride' },
  { category: 'travel', label: 'Metro / Train' },
  { category: 'food', label: 'Veg meal' },
  { category: 'electricity', label: 'Home electricity' },
];
const QUICK_LOGS = QUICK.map(({ category, label }) => {
  const opt = TRACK_OPTIONS[category].find((o) => o.label === label) as TrackOption;
  const qty = opt.defaultQty ?? 1;
  return { category, opt, qty, co2: round1(opt.factor * qty), note: `${qty} ${opt.unit ?? 'item'}` };
});

const BUDGET_DAY = round1(LIFESTYLE_BUDGET_KG_PER_DAY);
const BUDGET_WEEK = round1(LIFESTYLE_BUDGET_KG_PER_DAY * 7);

export default function Dashboard() {
  const { profile, todayTotal, deltaPct, yesterdayTotal, todayBreakdown, weekTotals, todayLogs, biggestSource, addLog, removeLog, addPlan, plan, todayKey } = useCarbon();
  const { world, pulse, emitPulse } = useLivingWorld();
  const { actual, goal, milestones, ledger, visual } = world;

  useRegisterPageContext({
    pageTitle: 'Dashboard',
    activeFeature: 'footprint_overview',
    visibleMetricIds: ['todayTotal', 'weekTotal', 'yesterdayTotal', 'biggestSource'],
    metadata: {
      todayTotal,
      yesterdayTotal,
      biggestCategory: biggestSource?.category ?? 'travel',
      biggestValue: biggestSource?.value ?? 0,
    },
  });

  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rewards, setRewards] = useState<RewardData[] | null>(null);

  useEffect(() => {
    getRewards()
      .then(setRewards)
      .catch(() => setRewards([]));
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const quickLog = async (q: (typeof QUICK_LOGS)[number]) => {
    setBusy(q.opt.label);
    try {
      await addLog({ category: q.category, label: q.opt.label, emoji: q.opt.emoji, co2: q.co2, note: q.note, date: todayKey }, logMetaFor(q.category, q.opt, q.qty));
      emitPulse('log');
      showToast(`Logged ${q.opt.label} · ${q.co2} kg CO₂e`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    await removeLog(id);
    emitPulse('remove');
  };

  // Swaps: the catalog actions for this week's biggest source, added to the plan — not logged, not credited.
  const planIds = new Set(plan.map((p) => p.templateId));
  const swaps = useMemo(() => {
    const cat = biggestSource?.category;
    const ordered = [...ACTIONS].sort((a, b) => Number(b.category === cat) - Number(a.category === cat) || b.saving - a.saving);
    return ordered.slice(0, 3);
  }, [biggestSource]);
  const plan1 = (id: string, title: string) => {
    addPlan(id);
    emitPulse('action');
    showToast(`Added to your plan: ${title}`);
  };

  const weekTotal = actual.thisWeekKg;
  const weekHasData = weekTotals.some((d) => d.total > 0);
  const loggedWeekDays = weekTotals.filter((d) => d.total > 0);
  const improving = deltaPct <= 0;
  const trend = actual.trend;
  const reachedCount = milestones.filter((m) => m.reached).length;
  const nextMilestone = milestones.find((m) => !m.reached);

  const balance = ledger?.balance ?? null;
  const nextReward = useMemo(() => {
    if (!rewards || rewards.length === 0 || balance === null) return null;
    const sorted = [...rewards].sort((a, b) => a.costCredits - b.costCredits);
    return sorted.find((r) => r.costCredits > balance) ?? sorted[sorted.length - 1];
  }, [rewards, balance]);

  return (
    <div className="flex flex-col gap-7">
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ type: 'spring', ...UI_SPRING }}
            className="fixed right-5 top-5 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-bold text-[#0c1d15] shadow-xl"
            style={{ background: 'var(--lime)' }}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ HERO — your planet and the four numbers that drive it ══════════ */}
      <motion.section aria-labelledby="dash-title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', ...UI_SPRING }}>
        <div
          className="relative overflow-hidden rounded-3xl border border-white/[0.06]"
          style={{ background: 'radial-gradient(120% 140% at 85% 20%, #10301f 0%, #07140f 45%, #040908 100%)' }}
        >
          <div className="relative z-10 grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="flex flex-col justify-between gap-6">
              <div>
                <div className="flex items-center gap-2.5 text-white/70">
                  <Globe2 className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-[0.2em]">
                    {greeting()}, {profile.name}
                  </span>
                </div>
                <h1 id="dash-title" className="mt-1 font-display text-[clamp(28px,5vw,42px)] font-extrabold leading-tight tracking-[-0.03em] text-white">
                  Your living planet
                </h1>
                <p className="mt-1 max-w-md text-sm text-white/65">
                  It reflects your logged average against a 1.5 °C lifestyle budget. Lighter days green it; logging more often doesn&apos;t change it on its own.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Kpi label="Today" value={round1(todayTotal)} unit="kg" provenance="logged">
                  {yesterdayTotal > 0 ? (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${improving ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                      {improving ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                      {Math.abs(deltaPct)}% vs yesterday
                    </span>
                  ) : (
                    <span className="text-[10px] text-white/45">no entry yesterday</span>
                  )}
                </Kpi>
                <Kpi label="This week" value={weekTotal} unit={`/ ${BUDGET_WEEK} kg`} provenance="logged">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10" title={`1.5 °C weekly budget: ${BUDGET_WEEK} kg — ${LIFESTYLE_BUDGET_SOURCE}`}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: weekTotal > BUDGET_WEEK ? '#e0a86a' : 'var(--lime)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (weekTotal / BUDGET_WEEK) * 100)}%` }}
                      transition={{ type: 'spring', stiffness: 60, damping: 18 }}
                    />
                  </div>
                </Kpi>
                <Kpi label="Avg / logged day" value={actual.avgPerLoggedDayKg ?? '—'} unit={actual.avgPerLoggedDayKg !== null ? 'kg' : ''} provenance="logged">
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-white/60" title={trend.basis}>
                    {trend.direction === 'down' ? <TrendingDown className="h-3 w-3 text-emerald-300" /> : trend.direction === 'up' ? <TrendingUp className="h-3 w-3 text-red-300" /> : <Minus className="h-3 w-3" />}
                    {trend.pct !== null ? `${trend.pct > 0 ? '+' : ''}${trend.pct}% vs last week` : 'trend needs 2 weeks'}
                  </span>
                </Kpi>
                <Kpi label="Streak" value={actual.streak} unit={actual.streak === 1 ? 'day' : 'days'} provenance="logged">
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-300/80">
                    <Flame className="h-3 w-3" />
                    {actual.loggedDaysThisWeek + actual.loggedDaysLastWeek} of 14 days logged
                  </span>
                </Kpi>
              </div>
            </div>

            <div className="relative flex justify-center">
              <PlanetPanel visual={visual} pulse={pulse.n} size={200} bare title="Your planet" className="text-white [--text:#eef6f1] [--muted:rgba(255,255,255,0.6)]">
                <Celebrate trigger={pulse.kind === 'milestone' ? pulse.n : 0} label="Milestone reached" />
              </PlanetPanel>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Quick actions ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Link href="/app/track" className="inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-2.5 text-sm font-bold text-[#0c1d15] transition-all hover:-translate-y-0.5 hover:shadow-glow-lime">
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Track activity
        </Link>
        <Link href="/app/coach" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-bold text-text transition-all hover:border-lime">
          <Sparkles className="h-4 w-4 text-lime" /> AI Coach
        </Link>
        <Link href="/app/simulate" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-bold text-text transition-all hover:border-lime">
          <FlaskConical className="h-4 w-4" /> Carbon Twin
        </Link>
        <Link href="/app/reports" className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-semibold text-muted transition-all hover:text-text">
          <FileText className="h-4 w-4" /> Export
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ── Left: analytics ─────────────────── */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          {/* Emissions Core — Score Ring + Category Breakdown */}
          <GlassCard delay={0.1} className="!rounded-[22px] !p-0 border border-emerald-500/25 bg-slate-900/60 shadow-lg shadow-emerald-500/5">
            <div className="gradient-border rounded-[22px]">
              <Card className="relative overflow-hidden !rounded-[22px] !p-0 bg-transparent">
                {/* Gradient header strip */}
                <div
                  className="relative px-6 py-7 sm:px-8 sm:py-8"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #0d9488 40%, #6366f1 100%)' }}
                >
                  <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-16 -left-8 h-48 w-48 rounded-full bg-white/10 blur-2xl" />

                  <div className="relative flex flex-col items-center gap-7 sm:flex-row sm:items-center">
                    {/* Score ring */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-full p-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <ScoreRing value={round1(todayTotal)} fraction={Math.min(1, todayTotal / BUDGET_DAY)} size={160} color="#ffffff" track="rgba(255,255,255,0.2)" textColor="#ffffff" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                          {improving ? '↓' : '↑'} {Math.abs(deltaPct)}% vs yesterday
                        </span>
                      </div>
                    </div>

                    {/* Category breakdown */}
                    <div className="w-full flex-1">
                      {todayLogs.length > 0 ? (
                        <div className="rounded-2xl bg-white/95 p-5 shadow-lg backdrop-blur-md" style={{ '--text': '#0f172a', '--muted': '#64748b', '--surface2': '#f1f5f9', color: '#0f172a' } as React.CSSProperties}>
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Emission Sources</span>
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">{todayLogs.length} events</span>
                          </div>
                          <CategoryBars data={todayBreakdown} />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
                          <SproutIllustration size={100} tone="white" />
                          <div className="text-lg font-bold text-white">Nothing logged today</div>
                          <p className="text-sm text-white/70">Log a commute, a meal or your electricity to see where today&apos;s kilograms come from.</p>
                          <Link href="/app/track" className="mt-1 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-emerald-800 transition-transform hover:scale-105">
                            + Log an activity
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-2 border-t border-white/15 pt-4 text-xs text-white/75 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      Ring and budget: {BUDGET_DAY} kg/day, the 1.5 °C lifestyle level for 2030 <span className="text-white/50">({LIFESTYLE_BUDGET_SOURCE.split(' — ')[0]})</span>
                    </span>
                    <Link href="/app/simulate" className="font-bold text-white underline underline-offset-2">
                      Try a change in Carbon Twin →
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          </GlassCard>

          {/* Weekly Emissions Trajectory */}
          <GlassCard delay={0.15} className="!rounded-[22px] p-5 sm:p-6 border border-emerald-500/20 bg-slate-900/60 shadow-lg shadow-emerald-500/5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--lime-soft), var(--blue-soft))' }}>
                    <BarChart3 className="h-4 w-4" style={{ color: 'var(--blue)' }} strokeWidth={2.5} />
                  </span>
                  <h2 className="text-base font-extrabold tracking-tight">Emissions Trajectory</h2>
                </div>
                <p className="mt-0.5 text-xs text-muted">Daily trend vs. Science-Based Target (8.5 kg threshold)</p>
              </div>
              <Link href="/app/insights" className="text-xs font-bold text-blue hover:underline">Full Analytics →</Link>
            </div>

            {weekHasData ? (
              <WeeklyChart data={weekTotals} height={150} targetBudget={8.5} />
            ) : (
              <div className="flex h-[150px] flex-col items-center justify-center gap-2 text-center">
                <BarChart3 className="h-8 w-8 text-muted/30" strokeWidth={1.5} />
                <p className="text-sm text-muted">No data yet this week</p>
              </div>
            )}

            {/* Summary row */}
            <div className="mt-5 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border bg-surface2 py-3.5 text-center">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">7-Day Total</div>
                <div className="mt-0.5 font-mono text-lg font-extrabold">{weekTotal} <span className="text-xs text-muted font-normal">kg</span></div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Daily Avg</div>
                <div className="mt-0.5 font-mono text-lg font-extrabold">
                  {round1(weekTotal / Math.max(1, weekTotals.filter((d) => d.total > 0).length))} <span className="text-xs text-muted font-normal">kg</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">Best Day</div>
                <div className="mt-0.5 font-mono text-lg font-extrabold" style={{ color: 'var(--lime)' }}>
                  {round1(Math.min(...weekTotals.filter((d) => d.total > 0).map((d) => d.total) || [0]))} <span className="text-xs text-muted font-normal">kg</span>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Hotspots */}
          <section aria-labelledby="hotspots">
            <h3 id="hotspots" className="mb-3 text-sm font-extrabold uppercase tracking-wider text-muted">
              Today&apos;s sources
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {(['travel', 'food', 'electricity', 'shopping', 'waste'] as Category[]).map((cat) => {
                const meta = CATEGORY_META[cat];
                const val = todayBreakdown[cat] || 0;
                const isBiggest = biggestSource?.category === cat && val > 0;
                return (
                  <TactileCard key={cat} className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 ${isBiggest ? 'border-lime/50' : 'border-border'}`} style={{ background: 'var(--card)' }}>
                    <div className="flex items-center justify-between">
                      <CategoryIcon category={cat} color={meta.color} size={36} />
                      {isBiggest && (
                        <span className="rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase" style={{ background: `color-mix(in srgb, ${meta.color} 18%, transparent)`, color: meta.color }}>
                          Week&apos;s top
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 text-xs font-bold text-muted">{meta.label}</div>
                    <div className="font-mono text-xl font-extrabold" style={{ color: meta.color }}>
                      {round1(val)} <span className="text-xs font-normal text-muted">kg</span>
                    </div>
                    <Link
                      href={`/app/track?cat=${cat}`}
                      className="mt-3 inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-surface py-1.5 text-[11px] font-bold text-muted transition-all hover:border-lime hover:text-lime-deep"
                    >
                      <Plus className="h-3 w-3" /> Log
                    </Link>
                  </TactileCard>
                );
              })}
            </div>
          </section>

          {/* Activity ledger */}
          <Card className="!rounded-[22px] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface2">
                  <Clock className="h-4 w-4 text-muted" strokeWidth={2.2} />
                </span>
                <h3 className="text-base font-extrabold">Logged today</h3>
              </div>
              <span className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-bold text-muted">{todayLogs.length} entries</span>
            </div>
            {todayLogs.length > 0 ? (
              <ul className="flex flex-col gap-1">
                <AnimatePresence initial={false}>
                  {todayLogs.map((log) => {
                    const meta = CATEGORY_META[log.category];
                    return (
                      <motion.li
                        key={log.id}
                        layout
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24, height: 0 }}
                        transition={{ type: 'spring', ...UI_SPRING }}
                        className="group flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-surface2"
                      >
                        <div className="flex items-center gap-3">
                          <CategoryIcon category={log.category} color={meta.color} size={38} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">{log.label}</span>
                              <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}>
                                {meta.label}
                              </span>
                            </div>
                            {log.note && <p className="text-xs text-muted">{log.note}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold">
                            +{round1(log.co2)} <span className="text-xs font-normal text-muted">kg</span>
                          </span>
                          {/* Visible on touch and keyboard focus, not only on hover. */}
                          <button
                            onClick={() => remove(log.id)}
                            aria-label={`Remove ${log.label}`}
                            className="rounded-lg p-1.5 text-muted transition-all hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            ) : (
              <div className="py-8 text-center">
                <SproutIllustration size={80} />
                <p className="mt-2 text-sm font-bold">No activities recorded today</p>
                <p className="text-xs text-muted">Your commutes, meals and energy use will show here.</p>
              </div>
            )}
          </Card>
        </div>

        {/* ── Right: guidance, plan, logging, rewards ──── */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          {/* AI Climate Advisor — Premium Glassmorphic card */}
          <GlassCard delay={0.12} className="!rounded-[22px] border border-emerald-500/30 bg-slate-900/60 shadow-lg shadow-emerald-500/10 p-[1px]">
            <div className="relative overflow-hidden rounded-[21px] p-[1px]" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))' }}>
              <div className="rounded-[20px] bg-slate-950/80 p-5 backdrop-blur-md">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #10b981, #6366f1)' }}>
                      <Sparkles className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="gradient-text text-[10px] font-extrabold uppercase tracking-wider">AI Climate Advisor</div>
                      <div className="text-sm font-extrabold text-white">Hotspot Analysis</div>
                    </div>
                  </div>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                </div>

                <p className="mt-3.5 text-[13px] leading-relaxed text-slate-300">
                  {biggestSource ? (
                    <>
                      <strong className="text-white">{CATEGORY_META[biggestSource.category].label}</strong> is your biggest source ({biggestSource.value} kg). Try a change in Carbon Twin or ask the coach which swaps apply to you.
                    </>
                  ) : (
                    'Log activities to get AI-powered reduction recommendations.'
                  )}
                </p>

                <Link
                  href="/app/coach"
                  className="mt-4 flex items-center justify-between rounded-xl px-4 py-3 text-xs font-bold text-white transition-all hover:shadow-glow-lime"
                  style={{ background: 'linear-gradient(135deg, #10b981, #6366f1)' }}
                >
                  <span>Chat with Climate Coach</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </GlassCard>

          {/* Swaps → the action plan */}
          <GlassCard delay={0.17} className="!rounded-[22px] p-5 border border-emerald-500/20 bg-slate-900/60 shadow-lg shadow-emerald-500/5">
            <div className="mb-3.5 flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Swaps for you</h3>
              <ProvenanceBadge provenance="estimate" />
            </div>
            <div className="flex flex-col gap-2.5">
              {swaps.map((a) => {
                const inPlan = planIds.has(a.id);
                return (
                  <div key={a.id} className="rounded-2xl border border-border bg-surface2 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-text">{a.title}</span>
                      <span className="whitespace-nowrap font-mono text-xs font-bold text-lime-deep">~{a.saving} kg/wk</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{a.desc}</p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        onClick={() => plan1(a.id, a.title)}
                        disabled={inPlan}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface py-2 text-xs font-bold text-text transition-all hover:border-lime hover:bg-lime hover:text-[#0c1d15] disabled:cursor-default disabled:opacity-60 disabled:hover:bg-surface disabled:hover:text-text"
                      >
                        {inPlan ? <Check className="h-3.5 w-3.5" /> : <ListPlus className="h-3.5 w-3.5" />}
                        {inPlan ? 'In your plan' : 'Add to plan'}
                      </button>
                      <Link href="/app/simulate" className="flex items-center justify-center rounded-xl border border-border bg-surface px-3 py-2 text-xs font-bold text-muted hover:text-text" aria-label={`Try ${a.title} in Carbon Twin`}>
                        <FlaskConical className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">Typical weekly savings from the action catalog — estimates, not measurements. Completing a plan action earns Green Points once.</p>
          </GlassCard>

          {/* Quick logger — same catalog and factors as Track */}
          <Card className="!rounded-[22px] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Quick log</h3>
              <Link href="/app/track" className="text-[11px] font-bold text-lime-deep hover:underline">
                More options
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              {QUICK_LOGS.map((q) => (
                <motion.button
                  key={q.opt.label}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', ...UI_SPRING }}
                  onClick={() => quickLog(q)}
                  disabled={busy === q.opt.label}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-3.5 py-3 text-left text-xs font-bold text-text transition-colors hover:border-lime disabled:opacity-50"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_META[q.category].color }} />
                    {q.opt.label} · {q.note}
                  </span>
                  <span className="font-mono text-muted">+{q.co2} kg</span>
                </motion.button>
              ))}
              <Link
                href="/app/track?add=1"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed px-3.5 py-3 text-xs font-bold text-lime-deep transition-colors hover:border-lime"
                style={{ borderColor: 'color-mix(in srgb, var(--lime) 45%, transparent)' }}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Add your own meal or item
              </Link>
            </div>
          </Card>

          {/* Milestones — persisted logs and ledger only */}
          <Card className="!rounded-[22px] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold">Milestones</h3>
              <span className="text-[11px] font-bold text-muted">
                {reachedCount}/{milestones.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {milestones.map((m) => (
                <span
                  key={m.id}
                  title={m.detail}
                  className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
                  style={{ borderColor: m.reached ? 'var(--lime)' : 'var(--border)', borderStyle: m.reached ? 'solid' : 'dashed', color: m.reached ? 'var(--lime-deep)' : 'var(--muted)', background: m.reached ? 'var(--lime-soft)' : 'transparent' }}
                >
                  {m.reached ? '✓ ' : ''}
                  {m.label}
                </span>
              ))}
            </div>
            {nextMilestone && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[11px] text-muted">
                  <span>Next: {nextMilestone.detail}</span>
                  <span>{Math.round(nextMilestone.progress * 100)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
                  <motion.div className="h-full rounded-full bg-lime" initial={{ width: 0 }} animate={{ width: `${nextMilestone.progress * 100}%` }} transition={{ type: 'spring', stiffness: 70, damping: 18 }} />
                </div>
              </div>
            )}
            {goal.targetKg !== null && (
              <p className="mt-3 text-[11px] leading-relaxed text-muted" title={goal.basis}>
                Weekly goal: cut {goal.weeklyGoalPct}% ({goal.targetKg} kg) vs last week. Completed actions cover ~{goal.completedSavingEstimateKg} kg <span className="font-semibold">(estimate)</span>.
              </p>
            )}
          </Card>

          {/* Rewards — the real ledger balance and the real catalog */}
          <Card className="!rounded-[22px] !p-0 overflow-hidden">
            <div className="p-5" style={{ background: 'linear-gradient(160deg, #10301f, #07140f)' }}>
              <div className="flex items-center gap-2">
                <Coins className="h-6 w-6 text-amber-300" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Green Points</div>
                  <div className="font-display text-2xl font-extrabold text-white">{balance === null ? '—' : balance.toLocaleString()}</div>
                </div>
              </div>
              {nextReward && balance !== null && (
                <div className="mt-3">
                  <div className="mb-1.5 flex justify-between text-[11px] text-white/70">
                    <span className="truncate pr-2">{nextReward.title}</span>
                    <span className="whitespace-nowrap font-bold text-white">
                      {Math.min(balance, nextReward.costCredits)} / {nextReward.costCredits}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                    <motion.div
                      className="h-full rounded-full bg-lime"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (balance / nextReward.costCredits) * 100)}%` }}
                      transition={{ type: 'spring', stiffness: 60, damping: 18 }}
                    />
                  </div>
                </div>
              )}
              <Link href="/app/rewards" className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-white/20">
                <span>Browse rewards</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
              <p className="mt-2.5 text-[10.5px] leading-relaxed text-white/45">In-app points, not carbon credits or offsets.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, unit, provenance, children }: { label: string; value: number | string; unit: string; provenance: 'logged'; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md" title={provenance === 'logged' ? 'From your logged activities' : undefined}>
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-display text-2xl font-extrabold text-white sm:text-3xl">{value}</span>
        <span className="font-mono text-xs text-white/50">{unit}</span>
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Stat({ label, value, unit, accent = false }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-extrabold" style={accent ? { color: 'var(--lime)' } : undefined}>
        {value} <span className="text-xs font-normal text-muted">{unit}</span>
      </div>
    </div>
  );
}
