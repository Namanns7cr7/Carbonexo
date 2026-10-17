'use client';

/**
 * "What you'll see" — the impact components rendered with clearly labelled
 * example data. Marketing context only: the data is passed in (defaults to
 * the fixtures), and the section says it is an example.
 */

import { DailyFootprint, WeeklyProgression, ReductionEstimates, ImpactPassport } from '@/components/visualizations';
import { SAMPLE_DAILY, SAMPLE_PASSPORT, SAMPLE_REDUCTIONS, SAMPLE_WEEK } from '@/lib/experience/fixtures';
import type { DailyFootprintData, ImpactPassportData, ReductionItem, WeeklyPoint } from '@/lib/experience/types';

export function ImpactPreview({
  id = 'impact',
  daily = SAMPLE_DAILY,
  week = SAMPLE_WEEK,
  reductions = SAMPLE_REDUCTIONS,
  passport = SAMPLE_PASSPORT,
}: {
  id?: string;
  daily?: DailyFootprintData;
  week?: WeeklyPoint[];
  reductions?: ReductionItem[];
  passport?: ImpactPassportData;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="dark px-6 py-[14vh]" style={{ background: 'linear-gradient(180deg, var(--void) 0%, #071510 100%)' }}>
      <div className="mx-auto max-w-[1240px]">
        <div className="max-w-[620px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: 'var(--mint)' }}>
            Your impact
          </p>
          <h2 id={`${id}-title`} className="mt-3 font-display text-[clamp(30px,4.6vw,54px)] font-extrabold leading-[1.02] tracking-[-0.032em] text-white">
            Your day, made visible.
          </h2>
          <p className="mt-5 text-[16.5px] leading-[1.65] text-white/70">
            Every number comes from what you log. Estimates are marked as estimates.
          </p>
          <p className="mt-4 inline-block rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] text-white/55">Example data shown</p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <DailyFootprint data={daily} />
          <WeeklyProgression series={week} className="lg:col-span-2" />
          <ReductionEstimates items={reductions} />
          <ImpactPassport data={passport} className="lg:col-span-2" />
        </div>
      </div>
    </section>
  );
}
