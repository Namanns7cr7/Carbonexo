'use client';

import { useState } from 'react';
import {
  ActionCompletion,
  CarbonCreditVault,
  DailyFootprint,
  GoalProgress,
  ImpactPassport,
  ReductionEstimates,
  WeeklyProgression,
} from '@/components/visualizations';
import {
  SAMPLE_ACTIONS,
  SAMPLE_CREDITS,
  SAMPLE_DAILY,
  SAMPLE_GOAL,
  SAMPLE_PASSPORT,
  SAMPLE_POINTS,
  SAMPLE_REDUCTIONS,
  SAMPLE_RETIREMENTS,
  SAMPLE_WEEK,
} from '@/lib/experience/fixtures';

type Mode = 'data' | 'loading' | 'empty';

/** Every visualization in each state, on the app's own themed surface. */
export function ComponentGallery() {
  const [mode, setMode] = useState<Mode>('data');
  const [actions, setActions] = useState(SAMPLE_ACTIONS);
  const loading = mode === 'loading';
  const d = mode === 'data';

  return (
    <div className="min-h-screen px-5 py-10 sm:px-8" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-lime">components/visualizations</p>
            <h1 className="mt-2 font-display text-[32px] font-extrabold tracking-[-0.03em]">Impact & vault components</h1>
            <p className="mt-2 max-w-[60ch] text-[14px] text-muted">
              Rendered with fictional SAMPLE fixtures from lib/experience/fixtures.ts. Use the theme toggle in the app to check dark mode.
            </p>
          </div>
          <div role="radiogroup" aria-label="State" className="flex rounded-[12px] border border-border bg-surface p-1">
            {(['data', 'loading', 'empty'] as Mode[]).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className="rounded-[9px] px-3.5 py-1.5 text-[13px] font-bold capitalize"
                style={mode === m ? { background: 'var(--lime)', color: '#0c1d15' } : { color: 'var(--muted)' }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 rounded-[12px] border border-dashed border-border px-4 py-2.5 text-[12.5px] font-semibold text-muted">
          Sample data — not real users, projects or registry records.
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <DailyFootprint data={d ? SAMPLE_DAILY : null} loading={loading} />
          <WeeklyProgression series={d ? SAMPLE_WEEK : null} loading={loading} className="lg:col-span-2" />
          <GoalProgress goal={d ? SAMPLE_GOAL : null} loading={loading} />
          <ReductionEstimates items={d ? SAMPLE_REDUCTIONS : null} loading={loading} />
          <ActionCompletion
            actions={d ? actions : null}
            loading={loading}
            onToggle={(id, done) => setActions((xs) => xs.map((a) => (a.id === id ? { ...a, done } : a)))}
          />
        </div>

        <div className="mt-4">
          <ImpactPassport data={d ? SAMPLE_PASSPORT : null} loading={loading} />
        </div>

        <h2 className="mb-4 mt-12 font-display text-[24px] font-extrabold tracking-[-0.02em]">Carbon Credit Vault</h2>
        <CarbonCreditVault
          points={d ? SAMPLE_POINTS : null}
          credits={d ? SAMPLE_CREDITS : null}
          retirements={d ? SAMPLE_RETIREMENTS : null}
          loading={loading}
        />
      </div>
    </div>
  );
}
