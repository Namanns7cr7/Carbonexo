'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Award, TrendingUp, Flame, CalendarCheck } from 'lucide-react';
import { getScore, type CreditScoreResponse } from '@/lib/api/score';
import { Card, PageHead, EmptyState } from '@/components/app/ui';
import { ScoreRing } from '@/components/app/charts';
import { useCountUp } from '@/lib/useCountUp';

const SCORE_MIN = 300;
const SCORE_MAX = 850;

const TIER_COLOR: Record<string, { text: string; soft: string }> = {
  Seedling: { text: 'var(--muted)', soft: 'var(--surface2)' },
  Sprout: { text: 'var(--blue)', soft: 'var(--blue-soft)' },
  Sapling: { text: 'var(--lime-deep)', soft: 'var(--lime-soft)' },
  'Forest Guardian': { text: 'var(--lime-deep)', soft: 'var(--lime-soft)' },
};

function ScoreValue({ score }: { score: number }) {
  // ScoreRing renders its own centered value text — we feed it the live
  // count-up display, and keep an invisible marker span (sized to match,
  // per useCountUp's HTMLSpanElement ref) for the IntersectionObserver so
  // the animation starts once the ring is actually on screen.
  const { ref, display } = useCountUp(score, { duration: 1400 });
  return (
    <div className="relative">
      <span ref={ref} aria-hidden className="absolute inset-0" />
      <ScoreRing value={display} unit={`out of ${SCORE_MAX}`} fraction={(score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)} size={220} />
    </div>
  );
}

export default function ScorePage() {
  const [data, setData] = useState<CreditScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getScore()
      .then(setData)
      .catch(() => setError('Could not load your Carbon Credit Score. Try again shortly.'));
  }, []);

  const tier = data ? TIER_COLOR[data.tier] ?? TIER_COLOR.Seedling : TIER_COLOR.Seedling;

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="Carbon Credit Score"
        title="Your Score"
        sub="A portable, explainable score built from your balance, streak, and consistency — the kind of proof-of-impact you could show an insurer, employer, or lender."
      />

      {error && <EmptyState emoji="" title="Couldn't load your score" sub={error} />}

      {!error && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="flex flex-col items-center gap-4 !p-8 text-center" style={{ boxShadow: '0 32px 64px -32px var(--shadow-strong)' }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'var(--lime-soft)' }}>
              <Award className="h-[22px] w-[22px]" style={{ color: 'var(--lime-deep)' }} strokeWidth={2.25} />
            </div>

            {data ? <ScoreValue score={data.score} /> : <ScoreRing value="…" unit={`out of ${SCORE_MAX}`} fraction={0} size={220} />}

            <span
              className="rounded-full px-4 py-1.5 text-sm font-extrabold"
              style={{ background: tier.soft, color: tier.text }}
            >
              {data ? data.tier : 'Loading…'}
            </span>

            <p className="max-w-[420px] text-sm leading-[1.5] text-muted">
              Your score reflects your lifetime credit balance, current streak, and consistency over the last 30 days — fully explainable, nothing hidden.
            </p>
          </Card>
        </motion.div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="flex flex-col items-center gap-2 !p-5 text-center">
            <TrendingUp className="h-5 w-5" style={{ color: 'var(--lime-deep)' }} strokeWidth={2.25} />
            <div className="font-display text-2xl font-extrabold">{data.balancePoints}<span className="text-sm font-bold text-muted"> / 300</span></div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Balance points</div>
            <div className="text-xs text-muted">{data.balance} credit balance</div>
          </Card>
          <Card className="flex flex-col items-center gap-2 !p-5 text-center">
            <Flame className="h-5 w-5" style={{ color: 'var(--blue)' }} strokeWidth={2.25} />
            <div className="font-display text-2xl font-extrabold">{data.streakPoints}<span className="text-sm font-bold text-muted"> / 150</span></div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Streak points</div>
            <div className="text-xs text-muted">{data.streak}-day streak</div>
          </Card>
          <Card className="flex flex-col items-center gap-2 !p-5 text-center">
            <CalendarCheck className="h-5 w-5" style={{ color: 'var(--lime-deep)' }} strokeWidth={2.25} />
            <div className="font-display text-2xl font-extrabold">{data.consistencyPoints}<span className="text-sm font-bold text-muted"> / 100</span></div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Consistency points</div>
            <div className="text-xs text-muted">{data.daysActiveLast30} active days / 30</div>
          </Card>
        </div>
      )}
    </div>
  );
}
