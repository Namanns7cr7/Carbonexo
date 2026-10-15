import { describe, it, expect } from 'vitest';
import { TRACK_OPTIONS } from './carbon';
import {
  factorOf,
  EXAMPLE_DAY,
  totalKg,
  breakdown,
  equivalentKm,
  simulateTwin,
  twinRange,
  TWIN_COMMUTE_KM,
  TWIN_COOLING_MAX_KWH,
  STORY_SWAPS,
  cumulativeSavings,
  yearly,
} from './story';

describe('factorOf', () => {
  it('reads the live catalog, not a copy', () => {
    const car = TRACK_OPTIONS.travel.find((o) => o.label === 'Car ride')!;
    expect(factorOf('travel', 'Car ride')).toBe(car.factor);
  });

  it('throws when an option is missing, so a catalog rename cannot go unnoticed', () => {
    expect(() => factorOf('travel', 'Hoverboard')).toThrow(/not in the travel catalog/);
  });
});

describe('example day', () => {
  it('derives every moment from factor × quantity', () => {
    for (const m of EXAMPLE_DAY) {
      expect(m.kg).toBeCloseTo(factorOf(m.category, m.option) * m.qty, 2);
    }
  });

  it('totals the day', () => {
    // 13 km car (2.34) + bottle (0.2) + chicken (1.2) + order (2.5) + 6 kWh AC (2.7)
    expect(totalKg(EXAMPLE_DAY)).toBeCloseTo(8.94, 2);
  });

  it('is in chronological order', () => {
    const times = EXAMPLE_DAY.map((m) => m.time);
    expect([...times].sort()).toEqual(times);
  });
});

describe('breakdown', () => {
  it('groups by category, heaviest first, with shares summing to 1', () => {
    const slices = breakdown(EXAMPLE_DAY);
    expect(slices.map((s) => s.category)).toEqual(['electricity', 'shopping', 'travel', 'food', 'waste']);
    expect(slices.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 6);
  });

  it('handles an empty day without dividing by zero', () => {
    expect(breakdown([])).toEqual([]);
  });
});

describe('equivalentKm', () => {
  it('converts kg into km by metro using the catalog factor', () => {
    // 2.34 kg / 0.04 kg per km
    expect(equivalentKm(2.34)).toBe(59);
  });

  it('refuses a zero-emission mode instead of returning Infinity', () => {
    expect(() => equivalentKm(1, 'Bike')).toThrow(/no emissions/);
  });
});

describe('simulateTwin', () => {
  it('computes a day from the three choices', () => {
    const r = simulateTwin({ commute: 'Car ride', lunch: 'Chicken meal', coolingKwh: 6 });
    expect(r.parts.commute).toBeCloseTo(factorOf('travel', 'Car ride') * TWIN_COMMUTE_KM, 1);
    expect(r.kg).toBeCloseTo(2.34 + 1.2 + 2.7, 1);
  });

  it('maps the cleanest and heaviest days to load 0 and 1', () => {
    expect(simulateTwin({ commute: 'Bike', lunch: 'Vegan meal', coolingKwh: 0 }).load).toBe(0);
    expect(simulateTwin({ commute: 'Car ride', lunch: 'Beef meal', coolingKwh: TWIN_COOLING_MAX_KWH }).load).toBe(1);
  });

  it('clamps cooling outside the slider range', () => {
    const over = simulateTwin({ commute: 'Bike', lunch: 'Vegan meal', coolingKwh: 99 });
    const max = simulateTwin({ commute: 'Bike', lunch: 'Vegan meal', coolingKwh: TWIN_COOLING_MAX_KWH });
    expect(over).toEqual(max);
  });

  it('has a non-degenerate range', () => {
    const { min, max } = twinRange();
    expect(max).toBeGreaterThan(min);
  });
});

describe('swaps', () => {
  it('come from the action catalog with their catalog savings', () => {
    expect(STORY_SWAPS.length).toBe(5);
    expect(STORY_SWAPS.every((s) => s.saving > 0)).toBe(true);
  });

  it('accumulate into a running weekly total', () => {
    const run = cumulativeSavings(STORY_SWAPS);
    expect(run).toHaveLength(STORY_SWAPS.length);
    for (let i = 1; i < run.length; i++) expect(run[i]).toBeGreaterThan(run[i - 1]);
    expect(run.at(-1)).toBeCloseTo(STORY_SWAPS.reduce((s, x) => s + x.saving, 0), 1);
  });

  it('carries a weekly figure across a year', () => {
    expect(yearly(20.5)).toBe(1066);
  });
});
