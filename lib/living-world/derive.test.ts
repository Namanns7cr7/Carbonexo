import { describe, expect, it } from 'vitest';
import {
  LIFESTYLE_BUDGET_KG_PER_DAY,
  WORLD_AVG_KG_PER_DAY,
  buildDays,
  buildLivingWorld,
  confidenceFor,
  deriveActual,
  deriveGoal,
  deriveMilestones,
  deriveScenario,
  deriveScenarioBaseVisual,
  deriveScenarioVisual,
  deriveTrend,
  deriveVisual,
  ledgerFacts,
  storyVitality,
  vitalityForDailyKg,
} from './derive';
import type { DayTotal } from './types';

const TODAY = new Date(2026, 9, 16);

/** 14 days, oldest first; `null` = not logged. */
function days(kgs: (number | null)[]): DayTotal[] {
  return buildDays(
    kgs.flatMap((kg, i) => {
      if (kg === null) return [];
      const d = new Date(2026, 9, 16 - (13 - i));
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return [{ date, kg }];
    }),
    TODAY,
  );
}

const actual = (kgs: (number | null)[], streak = 0) => deriveActual({ provenance: 'logged', days: days(kgs), streak });

describe('buildDays', () => {
  it('buckets 14 days ending today and marks zero-kg entries as logged', () => {
    const d = buildDays([{ date: '2026-10-16', kg: 0 }, { date: '2026-10-16', kg: 2.24 }, { date: '2026-10-03', kg: 1 }], TODAY);
    expect(d).toHaveLength(14);
    expect(d[0].date).toBe('2026-10-03');
    expect(d[13]).toEqual({ date: '2026-10-16', kg: 2.2, logged: true });
    expect(d[12].logged).toBe(false);
  });
});

describe('vitality', () => {
  it('is full at or under the 1.5 °C lifestyle budget and empty at 3×', () => {
    expect(vitalityForDailyKg(LIFESTYLE_BUDGET_KG_PER_DAY)).toBe(1);
    expect(vitalityForDailyKg(1)).toBe(1);
    expect(vitalityForDailyKg(LIFESTYLE_BUDGET_KG_PER_DAY * 3)).toBeCloseTo(0, 6);
    expect(vitalityForDailyKg(500)).toBe(0);
  });

  it('is monotonic: more emissions never make a healthier planet', () => {
    let prev = 2;
    for (let kg = 0; kg < 30; kg += 0.5) {
      const v = vitalityForDailyKg(kg);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });

  it('follows the per-logged-day average, so logging more often does not move the planet', () => {
    const sparse = actual([null, 10, null, 10, null, 10, null, null, 10, null, 10, null, 10, 10]);
    const dense = actual([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
    expect(sparse.avgPerLoggedDayKg).toBe(10);
    expect(dense.avgPerLoggedDayKg).toBe(10);
    // Same average, same confidence band → same planet.
    expect(deriveVisual(sparse).vitality).toBeCloseTo(deriveVisual(dense).vitality, 6);
  });

  it('stays neutral with no logs and is pulled toward neutral with few', () => {
    const none = actual(Array(14).fill(null));
    expect(deriveVisual(none)).toMatchObject({ vitality: 0.5, confidence: 'none' });
    const few = actual([...Array(13).fill(null), 2]);
    expect(few.confidence).toBe('low');
    const v = deriveVisual(few).vitality;
    expect(v).toBeGreaterThan(0.5);
    expect(v).toBeLessThan(1);
  });

  it('labels the basis with the cited budget', () => {
    const v = deriveVisual(actual(Array(14).fill(8)));
    expect(v.provenance).toBe('logged');
    expect(v.basis).toContain('UNEP (2020)');
  });

  it('does not reference the 8 kg/day savings baseline anywhere', () => {
    const w = buildLivingWorld({
      actual: { provenance: 'logged', days: days(Array(14).fill(8)), streak: 3 },
      goal: { weeklyGoalPct: 15, plan: [] },
      ledger: null,
      scenario: null,
    });
    expect(JSON.stringify(w)).not.toMatch(/saved/i);
  });
});

describe('trend', () => {
  it('needs two logged days in each week', () => {
    expect(deriveTrend(days([5, ...Array(6).fill(null), 4, 4, ...Array(5).fill(null)])).direction).toBe('unknown');
  });

  it('compares per-logged-day averages, not totals', () => {
    // Last week: 2 days × 10 = 20 kg. This week: 5 days × 6 = 30 kg — more total, lighter days.
    const t = deriveTrend(days([10, 10, null, null, null, null, null, 6, 6, 6, 6, 6, null, null]));
    expect(t.direction).toBe('down');
    expect(t.pct).toBe(-40);
  });

  it('treats small changes as flat', () => {
    expect(deriveTrend(days([10, 10, null, null, null, null, null, 10.2, 9.9, null, null, null, null, null])).direction).toBe('flat');
  });
});

describe('scenario', () => {
  const s = deriveScenario({ label: 'Metro instead of car', horizon: 'MONTH', baselineKg: 7.8, projectedKg: 1.7, deltaKg: -6.1, source: 'server' });

  it('spreads the delta per week and stays hypothetical', () => {
    expect(s.provenance).toBe('hypothetical');
    expect(s.weeklyDeltaKg).toBe(-1.4);
  });

  it('a reduction makes the hypothetical planet healthier than the actual one, and never edits actual', () => {
    const a = actual(Array(14).fill(14));
    const before = JSON.stringify(a);
    const base = deriveVisual(a);
    const big = deriveScenario({ label: 'x', horizon: 'MONTH', baselineKg: 100, projectedKg: 0, deltaKg: -100, source: 'server' });
    const what = deriveScenarioVisual(a, big);
    expect(what.vitality).toBeGreaterThan(base.vitality);
    expect(what.provenance).toBe('hypothetical');
    expect(what.basis).toMatch(/Hypothetical/);
    expect(JSON.stringify(a)).toBe(before);
  });

  it('starts from the sourced world average when the user has no logs', () => {
    const none = actual(Array(14).fill(null));
    expect(deriveScenarioBaseVisual(none).provenance).toBe('sourced');
    expect(deriveScenarioBaseVisual(none).vitality).toBeCloseTo(vitalityForDailyKg(WORLD_AVG_KG_PER_DAY), 6);
    expect(deriveScenarioVisual(none, s).basis).toContain('world average');
  });
});

describe('goal', () => {
  it('has no target without a logged previous week', () => {
    const g = deriveGoal(actual([...Array(7).fill(null), ...Array(7).fill(5)]), { weeklyGoalPct: 15, plan: [] });
    expect(g.targetKg).toBeNull();
    expect(g.progress).toBeNull();
  });

  it('uses catalog estimates for completed actions and labels them as estimates', () => {
    const g = deriveGoal(actual(Array(14).fill(10)), { weeklyGoalPct: 15, plan: [{ templateId: 'metro-commute', done: true }, { templateId: 'led-swap', done: false }] });
    expect(g.provenance).toBe('estimate');
    expect(g.targetKg).toBe(10.5);
    expect(g.completedSavingEstimateKg).toBe(8);
    expect(g.progress).toBeCloseTo(8 / 10.5, 6);
    expect(g.basis).toMatch(/not measured/);
  });
});

describe('milestones', () => {
  it('come only from persisted logs and ledger facts', () => {
    const m = deriveMilestones(actual(Array(14).fill(4), 7), { distinctActionsDone: 1, billsConfirmed: 0, balance: 125 });
    const by = Object.fromEntries(m.map((x) => [x.id, x.reached]));
    expect(by).toMatchObject({ 'first-log': true, 'streak-7': true, 'week-logged': true, 'first-action': true, 'five-actions': false, 'bill-confirmed': false });
  });

  it('counts distinct actions, so a replayed completion is not a second milestone', () => {
    const f = ledgerFacts(
      [
        { delta: 25, ruleKey: 'action_done', refId: 'a' },
        { delta: 25, ruleKey: 'action_done', refId: 'a' },
        { delta: 25, ruleKey: 'action_done', refId: 'b' },
        { delta: 15, ruleKey: 'bill_upload', refId: 'bill-1' },
        { delta: 100, ruleKey: 'signup_bonus', refId: 'u' },
      ],
      190,
    );
    expect(f).toEqual({ distinctActionsDone: 2, billsConfirmed: 1, balance: 190 });
  });
});

describe('story', () => {
  it('runs from a dark planet to a living one, monotonically', () => {
    expect(storyVitality(0)).toBeCloseTo(0.3, 6);
    expect(storyVitality(0)).toBeLessThan(0.5); // opens muted, below the unaltered imagery
    expect(storyVitality(1)).toBe(1);
    expect(storyVitality(0.5)).toBeGreaterThan(storyVitality(0.25));
  });
});

it('confidence bands', () => {
  expect([0, 1, 3, 7].map(confidenceFor)).toEqual(['none', 'low', 'medium', 'high']);
});
