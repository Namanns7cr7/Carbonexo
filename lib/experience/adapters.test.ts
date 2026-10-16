import { describe, it, expect } from 'vitest';
import { ACTIONS } from '../carbon';
import type { PlanRow } from '../store/types';
import { toDailyFootprint, toWeeklySeries, toActionItems, toReductions, toGreenPoints, pointsEarnedThisMonth } from './adapters';

const plan: PlanRow[] = [
  { templateId: 'metro-commute', addedAt: 1, done: true, template: ACTIONS.find((a) => a.id === 'metro-commute')! },
  { templateId: 'led-swap', addedAt: 2, done: false, template: ACTIONS.find((a) => a.id === 'led-swap')! },
];

describe('adapters', () => {
  it('maps today into a daily footprint, dropping empty categories', () => {
    const d = toDailyFootprint('2026-10-15', 6.444, { travel: 2.34, food: 1.2, electricity: 0, shopping: 2.5, waste: 0.404 }, 8);
    expect(d.kg).toBe(6.44);
    expect(d.goalKg).toBe(8);
    expect(d.byCategory?.map((c) => c.id)).toEqual(['travel', 'food', 'shopping', 'waste']);
    expect(d.byCategory?.find((c) => c.id === 'waste')?.kg).toBe(0.4);
  });

  it('maps week totals in order', () => {
    expect(toWeeklySeries([{ key: '2026-10-14', total: 7.126 }, { key: '2026-10-15', total: 6.4 }])).toEqual([
      { date: '2026-10-14', kg: 7.13 },
      { date: '2026-10-15', kg: 6.4 },
    ]);
  });

  it('labels catalog savings as estimates', () => {
    expect(toActionItems(plan).every((a) => a.basis === 'estimate')).toBe(true);
    expect(toActionItems(plan)[0]).toMatchObject({ id: 'metro-commute', done: true, kgPerWeek: 8 });
  });

  it('counts only completed actions as reductions', () => {
    expect(toReductions(plan).map((r) => r.id)).toEqual(['metro-commute']);
  });

  it('keeps Green Points as points, never credits', () => {
    expect(toGreenPoints({ balance: 120 })).toEqual({ kind: 'green-points', balance: 120, earnedThisMonth: undefined });
    expect(toGreenPoints(null)).toBeNull();
  });

  it('sums only this month’s positive ledger entries', () => {
    const now = new Date(2026, 9, 15);
    const history = [
      { delta: 50, createdAt: new Date(2026, 9, 2).toISOString() },
      { delta: -20, createdAt: new Date(2026, 9, 3).toISOString() },
      { delta: 30, createdAt: new Date(2026, 8, 29).toISOString() },
      { delta: 10, createdAt: new Date(2026, 9, 14).toISOString() },
    ];
    expect(pointsEarnedThisMonth(history, now)).toBe(60);
  });
});
