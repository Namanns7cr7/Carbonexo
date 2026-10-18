'use client';

/**
 * What the landing may honestly show about "you".
 *
 * Signed in → the user's real numbers from useCarbon() (the same store the
 * dashboard reads). Signed out → an example day built from the tracker's
 * emission factors (lib/story.ts), labelled as an example everywhere it
 * appears. The store's signed-out seed state (6.8 kg, a 5-day streak …) is
 * demo data and is never shown here as if it were the visitor's.
 */

import { useEffect, useMemo, useState } from 'react';
import { useCarbon } from '@/lib/store';
import { isAuthenticated } from '@/lib/api/auth';
import { ACTIONS, CATEGORY_META, type ActionTemplate, type Category } from '@/lib/carbon';
import { EXAMPLE_DAY, breakdown, totalKg } from '@/lib/story';

export interface FootprintView {
  mode: 'real' | 'example';
  name: string | null;
  totalKg: number;
  /** vs yesterday, % — real mode only. */
  deltaPct: number | null;
  slices: { category: Category; label: string; color: string; kg: number; share: number }[];
  /** Real: last 7 days. Example: the example day's moments in time order. */
  bars: { key: string; label: string; kg: number }[];
  barsLabel: string;
  biggest: { category: Category; label: string; kg: number } | null;
  /** Catalog action that targets the biggest source. Its saving is an estimate. */
  suggestion: ActionTemplate | null;
  streak: number | null;
  actionsDone: number | null;
  /** Average over days with anything logged, last 7 days. Never a 'saved' figure. */
  avgPerLoggedDayKg: number | null;
  daysTracked: number | null;
}

export function useJourneyData(): FootprintView {
  const carbon = useCarbon();
  const [authed, setAuthed] = useState(false);
  useEffect(() => setAuthed(isAuthenticated()), []);

  return useMemo<FootprintView>(() => {
    if (authed && carbon.bootstrapped) {
      const total = carbon.todayTotal;
      const slices = (Object.keys(carbon.todayBreakdown) as Category[])
        .map((c) => ({ category: c, label: CATEGORY_META[c].label, color: CATEGORY_META[c].color, kg: carbon.todayBreakdown[c], share: total > 0 ? carbon.todayBreakdown[c] / total : 0 }))
        .filter((x) => x.kg > 0)
        .sort((a, b) => b.kg - a.kg);
      const big = carbon.biggestSource;
      return {
        mode: 'real',
        name: carbon.profile.name || null,
        totalKg: Math.round(total * 10) / 10,
        deltaPct: Number.isFinite(carbon.deltaPct) && carbon.yesterdayTotal > 0 ? carbon.deltaPct : null,
        slices,
        bars: carbon.weekTotals.map((d) => ({
          key: d.key,
          label: new Date(d.key + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' }),
          kg: d.total,
        })),
        barsLabel: 'Last 7 days',
        biggest: big ? { category: big.category, label: CATEGORY_META[big.category].label, kg: big.value } : null,
        suggestion: big ? ACTIONS.find((a) => a.category === big.category) ?? null : null,
        streak: carbon.streak,
        actionsDone: carbon.completedCount,
        avgPerLoggedDayKg: (() => {
          const logged = carbon.weekTotals.filter((w) => w.total > 0);
          return logged.length ? Math.round((logged.reduce((s, w) => s + w.total, 0) / logged.length) * 10) / 10 : null;
        })(),
        daysTracked: carbon.daysTracked,
      };
    }

    const slices = breakdown(EXAMPLE_DAY);
    const top = slices[0] ?? null;
    return {
      mode: 'example',
      name: null,
      totalKg: Math.round(totalKg(EXAMPLE_DAY) * 10) / 10,
      deltaPct: null,
      slices,
      bars: EXAMPLE_DAY.map((m) => ({ key: m.time, label: m.time.slice(0, 2), kg: m.kg })),
      barsLabel: 'Through the day',
      biggest: top ? { category: top.category, label: top.label, kg: top.kg } : null,
      suggestion: top ? ACTIONS.find((a) => a.category === top.category) ?? null : null,
      streak: null,
      actionsDone: null,
      avgPerLoggedDayKg: null,
      daysTracked: null,
    };
  }, [authed, carbon]);
}
