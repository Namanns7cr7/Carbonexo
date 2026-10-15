'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, Flame, TrendingUp, Star, Cloud } from 'lucide-react';
import { useCarbon } from '@/lib/store';
import { CATEGORY_META } from '@/lib/carbon';
import { Card } from '@/components/app/ui';
import { ScoreRing, WeeklyChart, CategoryBars } from '@/components/app/charts';
import { SproutIllustration, CategoryIcon } from '@/components/app/illustrations';
import { RotatingGlobe } from '@/components/app/RotatingGlobe';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { profile, todayTotal, deltaPct, todayBreakdown, weekTotals, todayLogs, streak, biggestSource } = useCarbon();
  const improving = deltaPct <= 0;
  const fraction = Math.min(1, todayTotal / 12); // 12 kg ≈ a heavy day
  const weekHasData = weekTotals.some((d) => d.total > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-muted">{greeting()}, {profile.name} 👋</div>
          <h1 className="font-display text-[clamp(24px,4vw,32px)] font-extrabold tracking-[-0.03em]">Today&apos;s footprint</h1>
        </div>
        <Link
          href="/app/track"
          className="hidden rounded-[13px] bg-lime px-5 py-3 text-sm font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5 sm:inline-block"
          style={{ boxShadow: '0 12px 30px -14px var(--lime)' }}
        >
          + Track today
        </Link>
      </div>

      {/* score + breakdown — bold gradient hero, not a flat white card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="relative overflow-hidden !p-0">
          <div
            className="relative px-6 py-7 sm:px-8 sm:py-8"
            style={{ background: 'linear-gradient(135deg, var(--lime) 0%, var(--lime-deep) 100%)' }}
          >
            <div className="pointer-events-none absolute -right-12 -top-20 h-60 w-60 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-16 -left-8 h-44 w-44 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute right-4 top-4 hidden sm:block sm:right-6 sm:top-6">
              {/* small orbiting-star scene around the globe, for a fuller "space" corner */}
              <Star className="absolute -left-3 top-1 h-3 w-3 fill-white/70 text-white/70" strokeWidth={0} />
              <Star className="absolute -right-2 bottom-2 h-2 w-2 fill-white/50 text-white/50" strokeWidth={0} />
              <Cloud className="absolute -bottom-3 -left-5 h-5 w-5 text-white/50" strokeWidth={2} />
              <RotatingGlobe size={76} />
            </div>
            <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <div className="flex flex-col items-center gap-2">
                <ScoreRing value={todayTotal} fraction={fraction} size={150} color="#ffffff" track="rgba(255,255,255,0.28)" textColor="#ffffff" />
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white">
                  {improving ? '↓' : '↑'} {Math.abs(deltaPct)}% vs yesterday
                </span>
              </div>
              <div className="w-full flex-1">
                {/* Always-light glass panel: override the text/muted/surface2 CSS vars so
                    descendant Tailwind utilities stay legible against this white background
                    in dark mode too, not just the outer inline color. */}
                {todayLogs.length > 0 ? (
                  <div
                    className="rounded-2xl bg-white/95 p-4 sm:p-5"
                    style={{ '--text': '#0f231a', '--muted': '#5b6b62', '--surface2': '#f2f3ee', color: '#0f231a' } as React.CSSProperties}
                  >
                    <CategoryBars data={todayBreakdown} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
                    <SproutIllustration size={108} tone="white" />
                    <div>
                      <div className="text-lg font-bold text-white">Nothing logged yet today</div>
                      <p className="mt-1 text-sm text-white/80">Log your first activity to see your footprint build up.</p>
                    </div>
                    <Link
                      href="/app/track"
                      className="mt-1 rounded-xl bg-white px-4 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5"
                      style={{ color: 'var(--lime-deep)' }}
                    >
                      Track an activity
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* AI insight */}
      {biggestSource && (
        <Card className="flex items-start gap-3 !bg-lime-soft">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] bg-lime">
            <Sparkles className="h-4 w-4 text-[#0c1d15]" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold">AI Insight</div>
            <p className="mt-0.5 text-sm leading-[1.5] text-muted">
              <strong className="text-text">{CATEGORY_META[biggestSource.category].label}</strong> is your biggest source this week
              ({biggestSource.value} kg). <Link href="/app/coach" className="font-bold text-lime-deep underline-offset-2 hover:underline">Ask your coach</Link> how to cut it.
            </p>
          </div>
          <CategoryIcon category={biggestSource.category} color={CATEGORY_META[biggestSource.category].color} size={36} />
        </Card>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {/* weekly chart */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <span className="flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ background: 'var(--lime-soft)' }}>
                <TrendingUp className="h-4 w-4" style={{ color: 'var(--lime-deep)' }} strokeWidth={2} />
              </span>
              This week
            </h2>
            <Link href="/app/insights" className="text-xs font-semibold text-lime-deep hover:underline">Insights →</Link>
          </div>
          {weekHasData ? (
            <WeeklyChart data={weekTotals} />
          ) : (
            <div className="flex h-[120px] flex-col items-center justify-center gap-1 text-center">
              <TrendingUp className="h-7 w-7" style={{ color: 'var(--border)' }} strokeWidth={1.5} />
              <p className="text-sm text-muted">No activity yet this week</p>
            </div>
          )}
        </Card>

        {/* streak */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <span className="flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ background: 'var(--blue-soft)' }}>
                <Flame className="h-4 w-4" style={{ color: 'var(--blue)' }} strokeWidth={2} />
              </span>
              Streak
            </h2>
            <span className="text-xs font-semibold text-muted">{streak} day{streak === 1 ? '' : 's'}</span>
          </div>
          {streak > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: i < streak ? 'var(--blue-soft)' : 'var(--surface2)', border: i < streak ? 'none' : '1px solid var(--border)' }}
                  >
                    {i < streak && <Flame className="h-5 w-5" style={{ color: 'var(--blue)' }} strokeWidth={2} fill="var(--blue)" fillOpacity={0.2} />}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-muted">Keep logging daily to grow your streak and unlock badges.</p>
            </>
          ) : (
            <div className="flex h-[120px] flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--blue-soft)' }}>
                <Flame className="h-6 w-6" style={{ color: 'var(--blue)' }} strokeWidth={1.75} />
              </div>
              <p className="text-sm font-semibold">Start your streak today</p>
              <p className="text-xs text-muted">Log an activity to light the first flame.</p>
            </div>
          )}
        </Card>
      </div>

      <Link
        href="/app/track"
        className="rounded-[14px] bg-lime px-6 py-4 text-center text-base font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5 sm:hidden"
        style={{ boxShadow: '0 12px 30px -14px var(--lime)' }}
      >
        + Track today
      </Link>
    </div>
  );
}
