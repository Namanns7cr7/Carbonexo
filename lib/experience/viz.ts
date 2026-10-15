/**
 * Pure geometry and formatting for components/visualizations. No React, so
 * every number a chart draws is unit tested.
 */

import type { GoalData, WeeklyPoint } from './types';

/** A rounded-up axis maximum: 1, 2, 2.5, 5 or 10 × a power of ten. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

export interface LineGeometry {
  /** SVG path for the line. Empty when there are no points. */
  line: string;
  /** Closed SVG path for the area under the line. */
  area: string;
  points: { x: number; y: number; value: number; date: string }[];
  max: number;
}

/** Lay a series out in a w×h box with padding, y growing downward as in SVG. */
export function lineGeometry(series: WeeklyPoint[], w: number, h: number, pad = 8): LineGeometry {
  const max = niceMax(Math.max(0, ...series.map((p) => p.kg)));
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const step = series.length > 1 ? innerW / (series.length - 1) : 0;
  const points = series.map((p, i) => ({
    x: +(pad + (series.length > 1 ? i * step : innerW / 2)).toFixed(2),
    y: +(pad + innerH - (Math.max(0, p.kg) / max) * innerH).toFixed(2),
    value: p.kg,
    date: p.date,
  }));
  if (points.length === 0) return { line: '', area: '', points, max };
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const base = pad + innerH;
  const area = `${line} L${points[points.length - 1].x} ${base} L${points[0].x} ${base} Z`;
  return { line, area, points, max };
}

/** Change from the first half of a series to the second, as a fraction (−0.2 = 20% lower). */
export function trend(series: WeeklyPoint[]): number | null {
  if (series.length < 2) return null;
  const mid = Math.floor(series.length / 2);
  const avg = (xs: WeeklyPoint[]) => xs.reduce((s, p) => s + p.kg, 0) / xs.length;
  const before = avg(series.slice(0, mid));
  const after = avg(series.slice(series.length - mid));
  if (before === 0) return null;
  return (after - before) / before;
}

export type GoalStatus = 'met' | 'on-pace' | 'at-risk' | 'over';

/**
 * A budget goal is on pace while usage is no more than the elapsed share of
 * the budget (with a small allowance), at risk beyond that, and over once the
 * budget is spent. At period end, staying within budget means met.
 */
export function goalStatus(g: GoalData, allowance = 0.05): GoalStatus {
  if (g.usedKg > g.budgetKg) return 'over';
  if (g.elapsed >= 1) return 'met';
  const used = g.budgetKg > 0 ? g.usedKg / g.budgetKg : 1;
  return used <= g.elapsed + allowance ? 'on-pace' : 'at-risk';
}

export function formatKg(kg: number): string {
  const a = Math.abs(kg);
  if (a >= 1000) return `${(kg / 1000).toFixed(a >= 10_000 ? 0 : 1)} t`;
  if (a >= 100) return `${Math.round(kg)} kg`;
  return `${kg.toFixed(1)} kg`;
}

/** Short weekday label for a YYYY-MM-DD date, without timezone drift. */
export function weekdayLabel(date: string, locale = 'en-US'): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'short' });
}
