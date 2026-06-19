'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCarbon } from '@/lib/store';
import { CATEGORY_META } from '@/lib/carbon';
import { Card, EmptyState } from '@/components/app/ui';
import { ScoreRing, WeeklyChart, CategoryBars } from '@/components/app/charts';

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

      {/* score + breakdown */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="!p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
            <div className="flex flex-col items-center gap-2">
              <ScoreRing value={todayTotal} fraction={fraction} size={150} />
              <span
                className="rounded-full px-3 py-1 text-xs font-bold"
                style={{
                  background: improving ? 'var(--lime-soft)' : 'var(--blue-soft)',
                  color: improving ? 'var(--lime-deep)' : 'var(--blue)',
                }}
              >
                {improving ? '↓' : '↑'} {Math.abs(deltaPct)}% vs yesterday
              </span>
            </div>
            <div className="w-full flex-1">
              {todayLogs.length > 0 ? (
                <CategoryBars data={todayBreakdown} />
              ) : (
                <EmptyState
                  emoji="🌱"
                  title="Nothing logged yet today"
                  sub="Log your first activity to see your footprint build up."
                  action={
                    <Link href="/app/track" className="rounded-xl bg-lime px-4 py-2.5 text-sm font-bold text-[#0c1d15]">
                      Track an activity
                    </Link>
                  }
                />
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* AI insight */}
      {biggestSource && (
        <Card className="flex items-start gap-3 !bg-lime-soft" >
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] bg-lime text-base">✦</div>
          <div>
            <div className="text-sm font-bold">AI Insight</div>
            <p className="mt-0.5 text-sm leading-[1.5] text-muted">
              <strong className="text-text">{CATEGORY_META[biggestSource.category].label}</strong> is your biggest source this week
              ({biggestSource.value} kg). <Link href="/app/coach" className="font-bold text-lime-deep underline-offset-2 hover:underline">Ask your coach</Link> how to cut it.
            </p>
          </div>
        </Card>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {/* weekly chart */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-bold">This week</h2>
            <Link href="/app/insights" className="text-xs font-semibold text-lime-deep hover:underline">Insights →</Link>
          </div>
          <WeeklyChart data={weekTotals} />
        </Card>

        {/* streak */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-bold">Streak</h2>
            <span className="text-xs font-semibold text-muted">{streak} day{streak === 1 ? '' : 's'}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="flex h-11 w-11 items-center justify-center rounded-xl text-lg"
                style={{ background: i < streak ? 'var(--lime)' : 'var(--surface2)', border: i < streak ? 'none' : '1px solid var(--border)' }}
              >
                {i < streak ? '🔥' : ''}
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">Keep logging daily to grow your streak and unlock badges.</p>
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
