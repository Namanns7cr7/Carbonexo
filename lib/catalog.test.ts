import { describe, it, expect } from 'vitest';
import {
  ACTIONS, TRACK_OPTIONS, CATEGORIES, CATEGORY_META, DIFFICULTY_COLOR,
  addDays, dayKey, type Category,
} from './carbon';

describe('date helpers', () => {
  it('dayKey formats a fixed date as YYYY-MM-DD with zero padding', () => {
    // month is 0-indexed: 2 => March
    expect(dayKey(new Date(2026, 2, 5))).toBe('2026-03-05');
  });

  it('dayKey accepts an epoch millisecond number', () => {
    const ms = new Date(2026, 0, 1).getTime();
    expect(dayKey(ms)).toBe('2026-01-01');
  });

  it('addDays moves forward and backward without mutating the input', () => {
    const base = new Date(2026, 5, 15);
    expect(dayKey(addDays(base, 1))).toBe('2026-06-16');
    expect(dayKey(addDays(base, -1))).toBe('2026-06-14');
    expect(dayKey(base)).toBe('2026-06-15'); // base untouched
  });

  it('addDays rolls over month boundaries', () => {
    expect(dayKey(addDays(new Date(2026, 0, 31), 1))).toBe('2026-02-01');
  });
});

describe('catalog integrity', () => {
  it('every track option has a non-negative factor', () => {
    for (const opts of Object.values(TRACK_OPTIONS)) {
      for (const o of opts) expect(o.factor).toBeGreaterThanOrEqual(0);
    }
  });

  it('track options exist for every category', () => {
    for (const c of CATEGORIES) {
      expect(TRACK_OPTIONS[c.id].length).toBeGreaterThan(0);
    }
  });

  it('action ids are unique and savings are positive', () => {
    const ids = ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ACTIONS) expect(a.saving).toBeGreaterThan(0);
  });

  it('every action has a known difficulty colour', () => {
    for (const a of ACTIONS) {
      expect(DIFFICULTY_COLOR[a.difficulty]).toBeTruthy();
    }
  });

  it('CATEGORY_META is keyed by every category id', () => {
    for (const c of CATEGORIES) {
      const meta = CATEGORY_META[c.id as Category];
      expect(meta.label).toBe(c.label);
      expect(meta.emoji).toBe(c.emoji);
    }
  });
});
