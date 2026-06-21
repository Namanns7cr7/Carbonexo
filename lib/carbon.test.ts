import { describe, it, expect } from 'vitest';
import { round1, dayKey, dayTotal, breakdown, lastNDays, type LogEntry } from './carbon';

const log = (category: LogEntry['category'], co2: number, date: string): LogEntry => ({
  id: Math.random().toString(36).slice(2),
  category,
  label: 'x',
  emoji: '🌱',
  co2,
  date,
  createdAt: 0,
});

describe('carbon helpers', () => {
  it('round1 rounds to one decimal place', () => {
    expect(round1(1.234)).toBe(1.2);
    expect(round1(6.78)).toBe(6.8);
    expect(round1(2)).toBe(2);
  });

  it('lastNDays returns n ascending day keys ending today', () => {
    const days = lastNDays(7);
    expect(days).toHaveLength(7);
    expect(days[6]).toBe(dayKey(new Date()));
    // strictly ascending
    expect([...days].sort()).toEqual(days);
  });

  it('dayTotal sums only the given day', () => {
    const today = dayKey(new Date());
    const logs = [log('travel', 2.4, today), log('food', 1.2, today), log('food', 9.9, '2000-01-01')];
    expect(dayTotal(logs, today)).toBeCloseTo(3.6);
  });

  it('breakdown groups co2 by category and zero-fills the rest', () => {
    const b = breakdown([log('travel', 2.4, 'd'), log('food', 1.2, 'd'), log('travel', 0.6, 'd')]);
    expect(b.travel).toBeCloseTo(3.0);
    expect(b.food).toBeCloseTo(1.2);
    expect(b.electricity).toBe(0);
    expect(b.shopping).toBe(0);
    expect(b.waste).toBe(0);
  });
});
