'use client';

import Link from 'next/link';
import { useCarbon } from '@/lib/store';
import { CATEGORY_META, round1, type Category } from '@/lib/carbon';
import { Card, PageHead, Eyebrow, EmptyState } from '@/components/app/ui';
import { WeeklyChart, CategoryBars } from '@/components/app/charts';

export default function Insights() {
  const { weekTotals, weekBreakdown, biggestSource, deltaPct, todayLogs } = useCarbon();

  const weekTotal = round1(weekTotals.reduce((s, d) => s + d.total, 0));
  const activeDays = weekTotals.filter((d) => d.total > 0).length;
  const avg = activeDays ? round1(weekTotal / activeDays) : 0;
  const best = weekTotals.filter((d) => d.total > 0).sort((a, b) => a.total - b.total)[0];
  const bestDay = best ? new Date(`${best.key}T00:00:00`).toLocaleDateString('en', { weekday: 'long' }) : '—';

  const totalShare = Math.max(1, Object.values(weekBreakdown).reduce((s, v) => s + v, 0));
  const sharePct = (v: number) => Math.round((v / totalShare) * 100);

  if (todayLogs.length === 0 && weekTotal === 0) {
    return (
      <div>
        <PageHead eyebrow="Insights" title="Understand your footprint" />
        <EmptyState
          emoji="📊"
          title="Not enough data yet"
          sub="Log a few activities and we'll surface where your emissions come from."
          action={<Link href="/app/track" className="rounded-xl bg-lime px-4 py-2.5 text-sm font-bold text-[#0c1d15]">Start tracking</Link>}
        />
      </div>
    );
  }

  // plain-language, motivating insights derived from real data
  const insights: { emoji: string; text: React.ReactNode }[] = [];
  if (biggestSource) {
    const meta = CATEGORY_META[biggestSource.category];
    insights.push({
      emoji: meta.emoji,
      text: (
        <>
          <strong>{meta.label}</strong> makes up <strong>{sharePct(biggestSource.value)}%</strong> of your week — your single biggest
          lever. Small changes here move your total the most.
        </>
      ),
    });
  }
  insights.push({
    emoji: deltaPct <= 0 ? '📉' : '📈',
    text:
      deltaPct <= 0 ? (
        <>You&apos;re <strong>{Math.abs(deltaPct)}% lower</strong> than yesterday. Nice momentum — keep the streak alive.</>
      ) : (
        <>Today is <strong>{deltaPct}% higher</strong> than yesterday. A quick swap can bring it back down.</>
      ),
  });
  insights.push({
    emoji: '🏅',
    text: (
      <>Your lightest day this week was <strong>{bestDay}</strong> at <strong>{best ? round1(best.total) : 0} kg</strong>. Try to repeat what worked.</>
    ),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="Insights" title="Understand your footprint" sub="What's driving your emissions this week — in plain language." />

      {/* headline stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { v: `${weekTotal}`, u: 'kg this week', c: 'var(--text)' },
          { v: `${avg}`, u: 'kg / active day', c: 'var(--text)' },
          { v: `${activeDays}`, u: 'days tracked', c: 'var(--lime-deep)' },
        ].map((s) => (
          <Card key={s.u} className="!p-4 text-center">
            <div className="font-display text-[clamp(20px,5vw,28px)] font-extrabold" style={{ color: s.c }}>{s.v}</div>
            <div className="mt-0.5 text-[11px] font-semibold text-muted">{s.u}</div>
          </Card>
        ))}
      </div>

      {/* biggest source */}
      {biggestSource && (
        <Card className="!bg-lime-soft">
          <Eyebrow>Biggest source</Eyebrow>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-3xl">{CATEGORY_META[biggestSource.category].emoji}</div>
            <div>
              <div className="font-display text-xl font-extrabold">{CATEGORY_META[biggestSource.category].label}</div>
              <div className="text-sm text-muted">{biggestSource.value} kg · {sharePct(biggestSource.value)}% of your week</div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-[15px] font-bold">Weekly trend</h2>
          <WeeklyChart data={weekTotals} />
        </Card>
        <Card>
          <h2 className="mb-4 text-[15px] font-bold">By category</h2>
          <CategoryBars data={weekBreakdown} />
        </Card>
      </div>

      {/* plain-language insights */}
      <div>
        <h2 className="mb-3 text-[15px] font-bold">What this means</h2>
        <div className="flex flex-col gap-2.5">
          {insights.map((ins, i) => (
            <Card key={i} className="flex items-start gap-3 !py-4">
              <span className="text-xl">{ins.emoji}</span>
              <p className="text-sm leading-[1.55] text-muted">{ins.text}</p>
            </Card>
          ))}
        </div>
      </div>

      <Link
        href="/app/actions"
        className="rounded-[14px] bg-lime px-6 py-4 text-center text-base font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5"
        style={{ boxShadow: '0 12px 30px -14px var(--lime)' }}
      >
        See actions to cut emissions →
      </Link>
    </div>
  );
}
