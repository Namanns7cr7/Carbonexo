/**
 * Carbonexo scroll story — the numbers behind Chapters 2–5 of the home page.
 *
 * Nothing in here is invented. Every kilogram is derived from the same
 * emission-factor catalog (TRACK_OPTIONS) and action catalog (ACTIONS) that
 * the Track and Action Plan screens use, so the story and the product can
 * never disagree. If an option is renamed or removed from the catalog,
 * `factorOf` throws and the story's tests fail, rather than the landing page
 * silently showing a stale figure.
 *
 * The example day is illustrative — it is labelled as such in the UI — but its
 * arithmetic is real.
 *
 * Pure data + pure helpers: no React, testable under the `node` environment.
 */

import { ACTIONS, CATEGORY_META, TRACK_OPTIONS, round1, type ActionTemplate, type Category } from './carbon';

// ─── Catalog lookup ───────────────────────────────────────────────────────────

/** kg CO₂e per unit for a catalog option. Throws if the option is not in the catalog. */
export function factorOf(category: Category, label: string): number {
  const option = TRACK_OPTIONS[category].find((o) => o.label === label);
  if (!option) throw new Error(`story: "${label}" is not in the ${category} catalog`);
  return option.factor;
}

function emojiOf(category: Category, label: string): string {
  return TRACK_OPTIONS[category].find((o) => o.label === label)?.emoji ?? CATEGORY_META[category].emoji;
}

// ─── Chapter 2 — an example day ──────────────────────────────────────────────

export interface Moment {
  time: string;
  /** What the person did, in plain words. */
  title: string;
  category: Category;
  /** Catalog option label — the factor source. */
  option: string;
  emoji: string;
  qty: number;
  unit: 'km' | 'kWh' | 'item';
  /** kg CO₂e, factor × qty, rounded to 0.01. */
  kg: number;
}

function moment(time: string, title: string, category: Category, option: string, qty: number): Moment {
  const unit = TRACK_OPTIONS[category].find((o) => o.label === option)?.unit ?? 'item';
  return {
    time,
    title,
    category,
    option,
    emoji: emojiOf(category, option),
    qty,
    unit,
    kg: Math.round(factorOf(category, option) * qty * 100) / 100,
  };
}

/** One ordinary weekday, in the order it happens. */
export const EXAMPLE_DAY: Moment[] = [
  moment('08:40', 'Drive to work', 'travel', 'Car ride', 13),
  moment('11:15', 'Grab a bottled drink', 'waste', 'Plastic bottle', 1),
  moment('13:05', 'Chicken lunch', 'food', 'Chicken meal', 1),
  moment('17:30', 'An online order arrives', 'shopping', 'Online order', 1),
  moment('22:00', 'AC through the night', 'electricity', 'Air conditioning', 6),
];

export function totalKg(moments: Moment[]): number {
  return Math.round(moments.reduce((s, m) => s + m.kg, 0) * 100) / 100;
}

// ─── Chapter 3 — where it lands ──────────────────────────────────────────────

export interface Slice {
  category: Category;
  label: string;
  color: string;
  kg: number;
  /** 0..1 of the day's total. */
  share: number;
}

/** The day grouped by category, heaviest first. Shares sum to 1 for a non-empty day. */
export function breakdown(moments: Moment[]): Slice[] {
  const total = moments.reduce((s, m) => s + m.kg, 0);
  const byCat = new Map<Category, number>();
  for (const m of moments) byCat.set(m.category, (byCat.get(m.category) ?? 0) + m.kg);

  return Array.from(byCat.entries())
    .map(([category, kg]) => ({
      category,
      label: CATEGORY_META[category].label,
      color: CATEGORY_META[category].color,
      kg: Math.round(kg * 100) / 100,
      share: total > 0 ? kg / total : 0,
    }))
    .sort((a, b) => b.kg - a.kg);
}

/** How far the same emissions would carry you by a cleaner mode — a real-world yardstick. */
export function equivalentKm(kg: number, mode: string = 'Metro / Train'): number {
  const f = factorOf('travel', mode);
  if (f <= 0) throw new Error(`story: "${mode}" has no emissions, so it has no km-equivalent`);
  // Trim float noise first: 2.34 / 0.04 is 58.49999… in binary, which would round down.
  return Math.round(+(kg / f).toFixed(9));
}

// ─── Chapter 4 — the carbon twin preview ─────────────────────────────────────

export const TWIN_COMMUTE_KM = 13;
export const TWIN_COMMUTES = ['Car ride', 'Bus', 'Metro / Train', 'Bike'] as const;
export const TWIN_LUNCHES = ['Beef meal', 'Chicken meal', 'Veg meal', 'Vegan meal'] as const;
export const TWIN_COOLING_MAX_KWH = 8;

export interface TwinChoice {
  commute: (typeof TWIN_COMMUTES)[number];
  lunch: (typeof TWIN_LUNCHES)[number];
  /** AC use, kWh, 0..TWIN_COOLING_MAX_KWH. */
  coolingKwh: number;
}

export interface TwinResult {
  kg: number;
  parts: { commute: number; lunch: number; cooling: number };
  /** 0 = cleanest possible combination, 1 = heaviest. Drives the scene's haze. */
  load: number;
}

function twinParts(c: TwinChoice) {
  const cooling = Math.max(0, Math.min(TWIN_COOLING_MAX_KWH, c.coolingKwh));
  return {
    commute: factorOf('travel', c.commute) * TWIN_COMMUTE_KM,
    lunch: factorOf('food', c.lunch),
    cooling: factorOf('electricity', 'Air conditioning') * cooling,
  };
}

const sumParts = (p: { commute: number; lunch: number; cooling: number }) => p.commute + p.lunch + p.cooling;

/** The lightest and heaviest day the twin's controls can describe. */
export function twinRange(): { min: number; max: number } {
  const commutes = TWIN_COMMUTES.map((m) => factorOf('travel', m) * TWIN_COMMUTE_KM);
  const lunches = TWIN_LUNCHES.map((m) => factorOf('food', m));
  const ac = factorOf('electricity', 'Air conditioning');
  return {
    min: Math.min(...commutes) + Math.min(...lunches),
    max: Math.max(...commutes) + Math.max(...lunches) + ac * TWIN_COOLING_MAX_KWH,
  };
}

export function simulateTwin(c: TwinChoice): TwinResult {
  const p = twinParts(c);
  const kg = sumParts(p);
  const { min, max } = twinRange();
  return {
    kg: round1(kg),
    parts: { commute: round1(p.commute), lunch: round1(p.lunch), cooling: round1(p.cooling) },
    load: max > min ? Math.max(0, Math.min(1, (kg - min) / (max - min))) : 0,
  };
}

// ─── Chapter 5 — small swaps, compounding ────────────────────────────────────

const SWAP_IDS = ['metro-commute', 'meatless', 'cook-home', 'ac-timer', 'reusable-bottle'];

/** The swaps the story walks through, in order, straight from the action catalog. */
export const STORY_SWAPS: ActionTemplate[] = SWAP_IDS.map((id) => {
  const action = ACTIONS.find((a) => a.id === id);
  if (!action) throw new Error(`story: action "${id}" is not in the catalog`);
  return action;
});

/** Running weekly total after each swap — what the counter climbs through. */
export function cumulativeSavings(swaps: ActionTemplate[]): number[] {
  let run = 0;
  return swaps.map((s) => (run = round1(run + s.saving)));
}

/** A weekly estimate carried across a year. */
export function yearly(weeklyKg: number): number {
  return Math.round(weeklyKg * 52);
}
