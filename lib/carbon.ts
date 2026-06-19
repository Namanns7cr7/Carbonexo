/* ============================================================
   Carbonexo — domain model: categories, emission factors,
   the option catalog used by Track, and the action catalog.
   Pure data + pure helpers (no React, no storage).
   ============================================================ */

export type Category = 'travel' | 'food' | 'electricity' | 'shopping' | 'waste';

export const CATEGORIES: { id: Category; label: string; emoji: string; color: string }[] = [
  { id: 'travel', label: 'Travel', emoji: '🚗', color: 'var(--lime)' },
  { id: 'food', label: 'Food', emoji: '🍽️', color: 'var(--blue)' },
  { id: 'electricity', label: 'Electricity', emoji: '⚡', color: '#c4d98a' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️', color: '#e0a86a' },
  { id: 'waste', label: 'Waste', emoji: '🗑️', color: '#9b8cd6' },
];

export const CATEGORY_META: Record<Category, { label: string; emoji: string; color: string }> =
  Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as never;

/** A log entry — one tracked activity on a given day. */
export interface LogEntry {
  id: string;
  category: Category;
  label: string;
  emoji: string;
  co2: number; // kg CO₂e (always the emission; savings live on the plan)
  note?: string; // e.g. "13 km", "4 kWh"
  date: string; // YYYY-MM-DD (local)
  createdAt: number;
}

export interface Profile {
  name: string;
  onboarded: boolean;
  travelMode: string;
  dailyDistance: number; // km/day
  diet: string;
  electricity: string;
  shopping: string;
  weeklyGoalPct: number; // target % reduction
}

/** Templates used by the Track screen to log quickly. */
export interface TrackOption {
  label: string;
  emoji: string;
  /** kg CO₂ per unit (per km / per kWh / per item). */
  factor: number;
  /** unit for the quantity input; if omitted the item is a single tap (qty = 1). */
  unit?: 'km' | 'kWh' | 'item';
  defaultQty?: number;
}

export const TRACK_OPTIONS: Record<Category, TrackOption[]> = {
  travel: [
    { label: 'Car ride', emoji: '🚗', factor: 0.18, unit: 'km', defaultQty: 10 },
    { label: 'Motorbike', emoji: '🛵', factor: 0.1, unit: 'km', defaultQty: 10 },
    { label: 'Bus', emoji: '🚌', factor: 0.08, unit: 'km', defaultQty: 10 },
    { label: 'Metro / Train', emoji: '🚇', factor: 0.04, unit: 'km', defaultQty: 10 },
    { label: 'Flight', emoji: '✈️', factor: 0.25, unit: 'km', defaultQty: 500 },
    { label: 'Bike', emoji: '🚲', factor: 0, unit: 'km', defaultQty: 5 },
    { label: 'Walk', emoji: '🚶', factor: 0, unit: 'km', defaultQty: 3 },
  ],
  food: [
    { label: 'Beef meal', emoji: '🥩', factor: 5.0, unit: 'item', defaultQty: 1 },
    { label: 'Chicken meal', emoji: '🍗', factor: 1.2, unit: 'item', defaultQty: 1 },
    { label: 'Fish meal', emoji: '🐟', factor: 1.3, unit: 'item', defaultQty: 1 },
    { label: 'Veg meal', emoji: '🥗', factor: 0.6, unit: 'item', defaultQty: 1 },
    { label: 'Vegan meal', emoji: '🌱', factor: 0.4, unit: 'item', defaultQty: 1 },
    { label: 'Dairy', emoji: '🧀', factor: 1.0, unit: 'item', defaultQty: 1 },
    { label: 'Food delivery', emoji: '🛵', factor: 0.6, unit: 'item', defaultQty: 1 },
  ],
  electricity: [
    { label: 'Home electricity', emoji: '⚡', factor: 0.45, unit: 'kWh', defaultQty: 4 },
    { label: 'Air conditioning', emoji: '❄️', factor: 0.45, unit: 'kWh', defaultQty: 6 },
    { label: 'Geyser / heater', emoji: '🔥', factor: 0.45, unit: 'kWh', defaultQty: 3 },
    { label: 'Laundry + dryer', emoji: '🧺', factor: 0.45, unit: 'kWh', defaultQty: 2 },
  ],
  shopping: [
    { label: 'Clothing item', emoji: '👕', factor: 10, unit: 'item', defaultQty: 1 },
    { label: 'Electronics', emoji: '📱', factor: 30, unit: 'item', defaultQty: 1 },
    { label: 'Online order', emoji: '📦', factor: 2.5, unit: 'item', defaultQty: 1 },
    { label: 'Groceries', emoji: '🛒', factor: 1.0, unit: 'item', defaultQty: 1 },
  ],
  waste: [
    { label: 'General waste', emoji: '🗑️', factor: 0.5, unit: 'item', defaultQty: 1 },
    { label: 'Plastic bottle', emoji: '🥤', factor: 0.2, unit: 'item', defaultQty: 1 },
    { label: 'Food waste', emoji: '🍂', factor: 0.4, unit: 'item', defaultQty: 1 },
  ],
};

/** Recommendation catalog for the Action Plan screen. */
export interface ActionTemplate {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  category: Category;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  saving: number; // est. kg CO₂ saved per week
}

export const ACTIONS: ActionTemplate[] = [
  { id: 'metro-commute', emoji: '🚇', title: 'Take the metro twice a week', desc: 'Swap two car commutes for the metro.', category: 'travel', difficulty: 'Easy', saving: 8.0 },
  { id: 'meatless', emoji: '🥗', title: 'Two meat-free days', desc: 'Replace beef/chicken with plant meals twice weekly.', category: 'food', difficulty: 'Easy', saving: 6.4 },
  { id: 'ac-timer', emoji: '🌙', title: 'AC off 30 min earlier', desc: 'Use a timer so cooling stops before you sleep.', category: 'electricity', difficulty: 'Easy', saving: 2.1 },
  { id: 'reusable-bottle', emoji: '♻️', title: 'Carry a reusable bottle', desc: 'Cut single-use plastic on the go.', category: 'waste', difficulty: 'Easy', saving: 0.8 },
  { id: 'cook-home', emoji: '🍳', title: 'Cook three dinners at home', desc: 'Fewer deliveries means less packaging + transport.', category: 'food', difficulty: 'Medium', saving: 3.2 },
  { id: 'carpool', emoji: '🚙', title: 'Carpool on long trips', desc: 'Share rides to halve per-person travel emissions.', category: 'travel', difficulty: 'Medium', saving: 5.5 },
  { id: 'led-swap', emoji: '💡', title: 'Switch to LED bulbs', desc: 'Replace the 5 bulbs you use most.', category: 'electricity', difficulty: 'Medium', saving: 1.6 },
  { id: 'second-hand', emoji: '👕', title: 'Buy one fewer new item', desc: 'Choose second-hand or skip an impulse buy.', category: 'shopping', difficulty: 'Hard', saving: 9.0 },
];

export const DIFFICULTY_COLOR: Record<ActionTemplate['difficulty'], string> = {
  Easy: 'var(--lime)',
  Medium: 'var(--blue)',
  Hard: '#e0a86a',
};

/* ---- date + math helpers ---- */

export function dayKey(d: Date | number = new Date()): string {
  const dt = typeof d === 'number' ? new Date(d) : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

export function lastNDays(n: number): string[] {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => dayKey(addDays(today, -(n - 1 - i))));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Sum CO₂ of logs on a given day. */
export function dayTotal(logs: LogEntry[], key: string): number {
  return logs.filter((l) => l.date === key).reduce((s, l) => s + l.co2, 0);
}

/** Category → total kg over the supplied logs. */
export function breakdown(logs: LogEntry[]): Record<Category, number> {
  const out: Record<Category, number> = { travel: 0, food: 0, electricity: 0, shopping: 0, waste: 0 };
  for (const l of logs) out[l.category] += l.co2;
  return out;
}
