/**
 * Carbonexo store — seed data.
 *
 * Generates the initial state for a brand-new user (or after a reset).
 * Uses realistic sample values so every design screen looks populated
 * on first launch: 6.8 kg today · ↓12% · 5-day streak · 42 kg saved.
 *
 * Pure: no React, no localStorage, no side effects.
 */
import { lastNDays, round1, type Category, type LogEntry } from '@/lib/carbon';
import { STATE_VERSION } from '@/lib/constants';
import type { PersistedState } from './types';

// ─── ID generator ─────────────────────────────────────────────────────────────

let _seq = 0;

/** Generates a collision-resistant local ID (not a UUID). */
export function generateLocalId(): string {
  return `${Date.now().toString(36)}-${(_seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Log-entry factory ────────────────────────────────────────────────────────

function makeEntry(
  category: Category,
  label: string,
  emoji: string,
  co2: number,
  date: string,
  note?: string,
): LogEntry {
  return {
    id: generateLocalId(),
    category,
    label,
    emoji,
    co2: round1(co2),
    note,
    date,
    createdAt: Date.now(),
  };
}

// ─── Seed factory ─────────────────────────────────────────────────────────────

/**
 * Builds the initial `PersistedState` for a new user.
 * Oldest day is `days[0]`, today is `days[6]`.
 */
export function buildSeedState(): PersistedState {
  const days = lastNDays(7);
  const today = days[6];

  // Today → travel 3.1 / food 1.9 / electricity 1.8 = 6.8 kg
  const todayLogs: LogEntry[] = [
    makeEntry('travel', 'Car commute', '🚗', 2.4, today, '13 km'),
    makeEntry('travel', 'Metro ride', '🚇', 0.7, today, '17 km'),
    makeEntry('food', 'Chicken lunch', '🍗', 1.2, today, '1 meal'),
    makeEntry('food', 'Veg dinner', '🥗', 0.7, today, '1 meal'),
    makeEntry('electricity', 'Home electricity', '⚡', 1.8, today, '4 kWh'),
  ];

  // Prior days drive the weekly chart and the 5-day streak.
  // Days -5 and -6 (days[0] and days[1]) remain empty so the streak ends naturally.
  const priorTotals: Record<string, number> = {
    [days[5]]: 7.7,
    [days[4]]: 9.1,
    [days[3]]: 7.2,
    [days[2]]: 8.4,
  };

  const priorLogs: LogEntry[] = Object.entries(priorTotals).flatMap(([date, total]) => [
    makeEntry('travel', 'Car commute', '🚗', total * 0.46, date, 'commute'),
    makeEntry('food', 'Mixed meals', '🍽️', total * 0.28, date, 'meals'),
    makeEntry('electricity', 'Home electricity', '⚡', total * 0.26, date, 'kWh'),
  ]);

  return {
    version: STATE_VERSION,
    profile: {
      name: 'You',
      onboarded: false,
      travelMode: 'Car',
      dailyDistance: 18,
      diet: 'Mixed',
      electricity: 'Medium',
      shopping: 'Sometimes',
      weeklyGoalPct: 15,
    },
    logs: [...todayLogs, ...priorLogs],
    plan: [],
    stats: {
      savedBaseline: 42,
      actionsBaseline: 18,
    },
  };
}
