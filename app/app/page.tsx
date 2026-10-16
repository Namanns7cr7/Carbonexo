'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Flame,
  TrendingUp,
  TrendingDown,
  Plus,
  Leaf,
  ChevronRight,
  Target,
  Clock,
  ArrowRight,
  Trash2,
  Zap,
  Check,
  Globe2,
  BarChart3,
  ShieldCheck,
  TreePine,
  Wind,
  Droplets,
  Sun,
  FileText,
} from 'lucide-react';
import { useCarbon } from '@/lib/store';
import { CATEGORY_META, round1, type Category } from '@/lib/carbon';
import { Card } from '@/components/app/ui';
import { ScoreRing, WeeklyChart, CategoryBars } from '@/components/app/charts';
import { SproutIllustration, CategoryIcon } from '@/components/app/illustrations';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const FREQUENT_LOGS = [
  { label: 'Car Commute (12 km)', category: 'travel' as Category, emoji: '🚗', co2: 2.2, note: '12 km' },
  { label: 'Metro Ride', category: 'travel' as Category, emoji: '🚇', co2: 0.7, note: '15 km' },
  { label: 'Plant-Based Meal', category: 'food' as Category, emoji: '🥗', co2: 0.6, note: '1 meal' },
  { label: 'Home Energy (3h)', category: 'electricity' as Category, emoji: '⚡', co2: 1.4, note: '3 kWh' },
];

const SWAP_RECOMMENDATIONS = [
  {
    id: 'metro-swap',
    title: 'Switch Car → Metro',
    from: '🚗 Car 15km',
    to: '🚇 Metro',
    saved: 1.7,
    credits: 15,
    category: 'travel' as Category,
    icon: Wind,
    swapAction: { label: 'Metro ride', emoji: '🚇', co2: 0.7, note: 'Swapped from car · 15 km' },
  },
  {
    id: 'food-swap',
    title: 'Meat → Plant Bowl',
    from: '🍗 Beef',
    to: '🥗 Veg Bowl',
    saved: 1.1,
    credits: 10,
    category: 'food' as Category,
    icon: Leaf,
    swapAction: { label: 'Plant-based lunch', emoji: '🥗', co2: 0.6, note: 'Green swap · 1 meal' },
  },
  {
    id: 'energy-swap',
    title: 'AC → Eco Setting',
    from: '❄️ Heavy AC',
    to: '🍃 Eco 22°C',
    saved: 0.8,
    credits: 10,
    category: 'electricity' as Category,
    icon: Sun,
    swapAction: { label: 'Eco thermostat setting', emoji: '🍃', co2: 1.0, note: 'Smart cooling · 4 kWh' },
  },
];

const CAT_GRADIENTS: Record<Category, string> = {
  travel: 'from-emerald-500/20 to-teal-500/20',
  food: 'from-amber-500/20 to-orange-500/20',
  electricity: 'from-violet-500/20 to-indigo-500/20',
  shopping: 'from-rose-500/20 to-pink-500/20',
  waste: 'from-slate-500/20 to-gray-500/20',
};

const CAT_ICONS: Record<Category, typeof Wind> = {
  travel: Wind,
  food: Droplets,
  electricity: Zap,
  shopping: Globe2,
  waste: TreePine,
};

export default function Dashboard() {
  const {
    profile,
    todayTotal,
    deltaPct,
    todayBreakdown,
    weekTotals,
    todayLogs,
    streak,
    totalSaved,
    biggestSource,
    addLog,
    removeLog,
    todayKey,
  } = useCarbon();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleQuickLog = async (item: typeof FREQUENT_LOGS[0]) => {
    setLoggingId(item.label);
    try {
      await addLog({ category: item.category, label: item.label, emoji: item.emoji, co2: item.co2, note: item.note, date: todayKey });
      showToast(`✓ Logged ${item.label}`);
    } finally { setLoggingId(null); }
  };

  const handleApplySwap = async (swap: typeof SWAP_RECOMMENDATIONS[0]) => {
    setLoggingId(swap.id);
    try {
      await addLog({ category: swap.category, label: swap.swapAction.label, emoji: swap.swapAction.emoji, co2: swap.swapAction.co2, note: swap.swapAction.note, date: todayKey });
      showToast(`✓ ${swap.title} — saved ~${swap.saved} kg`);
    } finally { setLoggingId(null); }
  };

  const improving = deltaPct <= 0;
  const dailyBudget = 12.0;
  const fraction = Math.min(1, todayTotal / dailyBudget);
  const weekTotal = round1(weekTotals.reduce((a, c) => a + c.total, 0));
  const weekHasData = weekTotals.some((d) => d.total > 0);
  const ecoScore = Math.max(30, Math.min(96, Math.round(100 - (todayTotal / dailyBudget) * 45)));
  const treesEquiv = round1(totalSaved * 0.05);

  return (
    <div className="flex flex-col gap-7">
      {/* ── Toast ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className="fixed right-5 top-5 z-50 flex items-center gap-3 rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-xl"
            style={{ background: 'linear-gradient(135deg, #10b981, #6366f1)' }}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════
          HERO BANNER — Full-Width Cinematic Earth Card
          ══════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="relative overflow-hidden rounded-3xl" style={{ minHeight: 280 }}>
          {/* Background Image */}
          <Image
            src="/images/hero-earth.jpg"
            alt="Planet Earth from space"
            fill
            className="object-cover"
            priority
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Content */}
          <div className="relative z-10 flex h-full min-h-[280px] flex-col justify-between p-6 sm:p-8">
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2.5 text-white/70">
                  <Globe2 className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-[0.2em]">
                    {greeting()}, {profile.name}
                  </span>
                </div>
                <h1 className="mt-1 font-display text-[clamp(28px,5vw,42px)] font-extrabold leading-tight tracking-[-0.03em] text-white">
                  Climate Dashboard
                </h1>
                <p className="mt-1 max-w-md text-sm text-white/60">
                  Real-time emissions intelligence · Net-zero trajectory · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>

              {/* Live status badge */}
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md sm:flex">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-bold text-white/90">Net-Zero Active</span>
              </div>
            </div>

            {/* Bottom KPI strip inside hero */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Today footprint */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Today&apos;s Footprint</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-extrabold text-white sm:text-3xl">{round1(todayTotal)}</span>
                  <span className="font-mono text-xs text-white/50">kg CO₂</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${improving ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                    {improving ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                    {Math.abs(deltaPct)}%
                  </span>
                  <span className="text-[10px] text-white/40">vs yesterday</span>
                </div>
              </div>

              {/* Weekly budget */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Weekly Budget</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-extrabold text-white sm:text-3xl">{weekTotal}</span>
                  <span className="font-mono text-xs text-white/50">/ 60 kg</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, (weekTotal / 60) * 100)}%`,
                      background: 'linear-gradient(90deg, #34d399, #818cf8)',
                    }}
                  />
                </div>
              </div>

              {/* Avoided */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">CO₂ Avoided</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-extrabold sm:text-3xl" style={{ color: '#34d399' }}>{round1(totalSaved)}</span>
                  <span className="font-mono text-xs text-white/50">kg</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-300/70">
                  <TreePine className="h-3 w-3" />
                  <span>≈ {treesEquiv} trees equiv.</span>
                </div>
              </div>

              {/* Eco score */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">Eco Score</div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-extrabold text-white sm:text-3xl">{ecoScore}</span>
                  <span className="font-mono text-xs text-white/50">/ 100</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                  <Flame className="h-3 w-3 text-amber-400" />
                  <span className="text-amber-300/80">{streak}-day streak · 1.5x multiplier</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Quick Actions Bar ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href="/app/track"
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-glow-lime"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Track Activity
        </Link>
        <Link href="/app/coach" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:shadow-glow-violet" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          <Sparkles className="h-4 w-4" /> AI Coach
        </Link>
        <Link href="/app/simulate" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-bold text-text transition-all hover:border-lime hover:shadow-soft">
          <BarChart3 className="h-4 w-4" /> Simulate
        </Link>
        <Link href="/app/reports" className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-semibold text-muted transition-all hover:border-blue hover:text-text">
          <FileText className="h-4 w-4" /> Export
        </Link>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MAIN GRID — 2 Column Layout
          ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ── Left Column: Analytics (8 cols) ─────────────────── */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          {/* Emissions Core — Score Ring + Category Breakdown */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
            <div className="gradient-border rounded-[22px]">
              <Card className="relative overflow-hidden !rounded-[22px] !p-0">
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
                        <ScoreRing value={todayTotal} fraction={fraction} size={160} color="#ffffff" track="rgba(255,255,255,0.2)" textColor="#ffffff" />
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
                          <div className="text-lg font-bold text-white">No emissions logged yet</div>
                          <p className="text-sm text-white/70">Start tracking to see your live carbon breakdown.</p>
                          <Link href="/app/track" className="mt-1 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-emerald-700 transition-all hover:scale-105 hover:shadow-lg">+ Log First Activity</Link>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Peer benchmark */}
                  <div className="mt-5 flex flex-col gap-2 border-t border-white/15 pt-4 text-xs text-white/80 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-1.5">
                      <Target className="h-4 w-4" />
                      <span><strong className="text-white">38% below</strong> the regional peer average (11.0 kg/day)</span>
                    </div>
                    <Link href="/app/simulate" className="font-bold text-white underline underline-offset-2 hover:text-emerald-200">
                      Simulate reductions →
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          </motion.div>

          {/* Weekly Emissions Trajectory */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
            <Card className="!rounded-[22px] p-5 transition-all hover:shadow-soft sm:p-6">
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
            </Card>
          </motion.div>

          {/* Hotspot Category Matrix */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted">Emission Hotspots</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {(['travel', 'food', 'electricity', 'shopping', 'waste'] as Category[]).map((cat) => {
                const meta = CATEGORY_META[cat];
                const val = todayBreakdown[cat] || 0;
                const isBiggest = biggestSource?.category === cat && val > 0;
                const Icon = CAT_ICONS[cat];

                return (
                  <Card
                    key={cat}
                    className={`!rounded-2xl relative flex flex-col justify-between overflow-hidden p-4 transition-all hover:-translate-y-1 hover:shadow-lift ${isBiggest ? 'gradient-border' : ''}`}
                  >
                    {/* Gradient background shimmer */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${CAT_GRADIENTS[cat]} opacity-40`} />

                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${meta.color}18` }}>
                          <Icon className="h-4 w-4" style={{ color: meta.color }} strokeWidth={2} />
                        </div>
                        {isBiggest && (
                          <span className="rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase" style={{ background: `${meta.color}20`, color: meta.color }}>
                            Hotspot
                          </span>
                        )}
                      </div>
                      <div className="mt-2.5 text-xs font-bold text-muted">{meta.label}</div>
                      <div className="font-mono text-xl font-extrabold" style={{ color: meta.color }}>
                        {round1(val)} <span className="text-xs text-muted font-normal">kg</span>
                      </div>
                    </div>

                    <Link
                      href={`/app/track?cat=${cat}`}
                      className="relative mt-3 inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-surface py-1.5 text-[11px] font-bold text-muted transition-all hover:border-lime hover:text-lime-deep"
                    >
                      <Plus className="h-3 w-3" /> Log
                    </Link>
                  </Card>
                );
              })}
            </div>
          </motion.div>

          {/* Activity Ledger */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }}>
            <Card className="!rounded-[22px] p-5 transition-all hover:shadow-soft sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface2">
                    <Clock className="h-4 w-4 text-muted" strokeWidth={2.2} />
                  </span>
                  <h3 className="text-base font-extrabold">Activity Ledger</h3>
                </div>
                <span className="rounded-full bg-surface2 px-2.5 py-1 text-xs font-bold text-muted">{todayLogs.length} today</span>
              </div>

              {todayLogs.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {todayLogs.map((log, idx) => {
                    const meta = CATEGORY_META[log.category];
                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="group flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-surface2"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface2 text-lg shadow-sm">{log.emoji}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold">{log.label}</span>
                              <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${meta.color}15`, color: meta.color }}>{meta.label}</span>
                            </div>
                            {log.note && <p className="text-xs text-muted">{log.note}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm font-bold">+{round1(log.co2)} <span className="text-xs text-muted font-normal">kg</span></span>
                          <button onClick={() => removeLog(log.id)} className="rounded-lg p-1.5 text-muted opacity-0 transition-all hover:bg-danger-soft hover:text-danger group-hover:opacity-100" title="Remove">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <SproutIllustration size={80} />
                  <p className="mt-2 text-sm font-bold">No activities recorded today</p>
                  <p className="text-xs text-muted">Your commutes, meals, and energy usage will show here.</p>
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* ── Right Column: Intelligence & Actions (4 cols) ──── */}
        <div className="flex flex-col gap-6 lg:col-span-4">
          {/* AI Climate Advisor — Premium gradient card */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.4 }}>
            <div className="relative overflow-hidden rounded-[22px] p-[1px]" style={{ background: 'linear-gradient(135deg, #10b981, #6366f1, #8b5cf6)' }}>
              <div className="rounded-[21px] bg-surface p-5" style={{ background: 'var(--card)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #10b981, #6366f1)' }}>
                      <Sparkles className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                    <div>
                      <div className="gradient-text text-[10px] font-extrabold uppercase tracking-wider">AI Climate Advisor</div>
                      <div className="text-sm font-extrabold text-text">Hotspot Analysis</div>
                    </div>
                  </div>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                </div>

                <p className="mt-3.5 text-[13px] leading-relaxed text-muted">
                  {biggestSource ? (
                    <>
                      <strong className="text-text">{CATEGORY_META[biggestSource.category].label}</strong> is your biggest source ({biggestSource.value} kg). Switching 2 commutes could save <strong className="gradient-text">~8.4 kg CO₂</strong> and earn 40 credits.
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
          </motion.div>

          {/* Carbon Swaps */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17, duration: 0.4 }}>
            <Card className="!rounded-[22px] p-5 transition-all hover:shadow-soft">
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, var(--accent-amber), var(--accent-teal))' }}>
                    <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
                  </span>
                  <h3 className="text-sm font-extrabold">Carbon Swaps</h3>
                </div>
                <span className="rounded-full bg-lime-soft px-2 py-0.5 text-[10px] font-bold text-lime-deep">1-Click</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {SWAP_RECOMMENDATIONS.map((swap) => {
                  const SwapIcon = swap.icon;
                  return (
                    <div key={swap.id} className="rounded-2xl border border-border bg-surface2 p-3.5 transition-all hover:border-lime/40 hover:shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <SwapIcon className="h-4 w-4 text-lime" />
                          <span className="text-xs font-bold text-text">{swap.title}</span>
                        </div>
                        <span className="font-mono text-xs font-bold text-lime-deep">-{swap.saved} kg</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
                        <span className="line-through opacity-60">{swap.from}</span>
                        <span className="gradient-text font-bold">→</span>
                        <span className="font-semibold text-text">{swap.to}</span>
                      </div>
                      <button
                        onClick={() => handleApplySwap(swap)}
                        disabled={loggingId === swap.id}
                        className="mt-2.5 w-full rounded-xl border border-border bg-surface py-2 text-center text-xs font-bold text-text transition-all hover:bg-lime hover:text-white hover:border-lime hover:shadow-glow-lime disabled:opacity-50"
                      >
                        {loggingId === swap.id ? 'Applying...' : `Apply Swap (+${swap.credits} Credits)`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          {/* Quick Logger */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.4 }}>
            <Card className="!rounded-[22px] p-5 transition-all hover:shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface2">
                    <Plus className="h-4 w-4 text-muted" strokeWidth={2.5} />
                  </span>
                  <h3 className="text-sm font-extrabold">Quick Logger</h3>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {FREQUENT_LOGS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleQuickLog(item)}
                    disabled={loggingId === item.label}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-3.5 py-3 text-left text-xs font-bold text-text transition-all hover:border-lime hover:bg-lime-soft/30 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{item.emoji}</span>
                      <span>{item.label}</span>
                    </div>
                    <span className="font-mono text-muted">+{item.co2}kg</span>
                  </button>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Eco Rewards — Forest card background */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27, duration: 0.4 }}>
            <div className="relative overflow-hidden rounded-[22px]" style={{ minHeight: 200 }}>
              <Image src="/images/eco-forest.jpg" alt="Rainforest canopy" fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/30" />
              <div className="relative z-10 flex h-full min-h-[200px] flex-col justify-end p-5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🪙</span>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">Eco Rewards</div>
                    <div className="font-display text-2xl font-extrabold text-white">150 Credits</div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1.5 flex justify-between text-[11px] text-white/70">
                    <span>Tree Certificate</span>
                    <span className="font-bold text-white">150 / 200</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: '75%', background: 'linear-gradient(90deg, #34d399, #818cf8)' }} />
                  </div>
                </div>
                <Link href="/app/rewards" className="mt-3 flex items-center justify-between rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20">
                  <span>Browse Rewards Store</span>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
