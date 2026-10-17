/**
 * "My items" — activities a user adds themselves when the Track catalog
 * doesn't have them (a homemade dish, a new gadget, a ferry ride…).
 *
 * A custom item is a TrackOption with the user's own kg CO₂e per unit. The
 * rate is the user's estimate, optionally copied from a similar catalog item,
 * and every log made from it says so. Saved items live in this browser only.
 *
 * Pure helpers + a thin storage wrapper; no React.
 */

import type { Category, TrackOption } from './carbon';

export type CustomUnit = NonNullable<TrackOption['unit']>;

export interface CustomItem {
  id: string;
  category: Category;
  label: string;
  /** kg CO₂e per unit — the user's estimate. */
  factor: number;
  unit: CustomUnit;
  defaultQty: number;
  /** Catalog item the rate was copied from, if any. Shown so the estimate is traceable. */
  basedOn?: string;
}

/** A TrackOption that came from "My items". */
export type CustomTrackOption = TrackOption & { customId: string; basedOn?: string };

export const CUSTOM_ITEMS_KEY = 'cx-custom-items';
export const MAX_CUSTOM_ITEMS = 40;
/** kg CO₂e per unit above which an entry is almost certainly a typo (a long-haul flight is ~0.25/km; a laptop ~300/item). */
export const MAX_FACTOR = 2000;
export const MAX_NAME = 60;

/** Sensible starting unit per category. */
export const DEFAULT_UNIT: Record<Category, CustomUnit> = {
  travel: 'km',
  food: 'item',
  electricity: 'kWh',
  shopping: 'item',
  waste: 'item',
};

export interface CustomDraft {
  category: Category;
  label: string;
  factor: number;
  unit: CustomUnit;
  qty: number;
  basedOn?: string;
}

export type DraftErrors = Partial<Record<'label' | 'factor' | 'qty', string>>;

export function validateDraft(d: CustomDraft): DraftErrors {
  const e: DraftErrors = {};
  const name = d.label.trim();
  if (!name) e.label = 'Give it a name.';
  else if (name.length > MAX_NAME) e.label = `Keep it under ${MAX_NAME} characters.`;
  if (!Number.isFinite(d.factor) || d.factor < 0) e.factor = 'Enter 0 or more kg CO₂e.';
  else if (d.factor > MAX_FACTOR) e.factor = `That's over ${MAX_FACTOR} kg per ${d.unit} — check the number.`;
  if (!Number.isFinite(d.qty) || d.qty <= 0) e.qty = 'Enter an amount above 0.';
  return e;
}

export function estimateKg(d: Pick<CustomDraft, 'factor' | 'qty'>): number {
  if (!Number.isFinite(d.factor) || !Number.isFinite(d.qty)) return 0;
  return Math.round(d.factor * d.qty * 10) / 10;
}

export function makeId(): string {
  return `ci-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function toCustomItem(d: CustomDraft, id: string = makeId()): CustomItem {
  return {
    id,
    category: d.category,
    label: d.label.trim().slice(0, MAX_NAME),
    factor: Math.round(d.factor * 1000) / 1000,
    unit: d.unit,
    defaultQty: d.qty,
    basedOn: d.basedOn,
  };
}

export function toTrackOption(c: CustomItem): CustomTrackOption {
  return { label: c.label, emoji: '', factor: c.factor, unit: c.unit, defaultQty: c.defaultQty, customId: c.id, basedOn: c.basedOn };
}

export function isCustom(o: TrackOption): o is CustomTrackOption {
  return typeof (o as CustomTrackOption).customId === 'string';
}

/** Same name in the same category replaces the old item, newest first, capped. */
export function upsert(items: CustomItem[], item: CustomItem): CustomItem[] {
  const key = (i: CustomItem) => `${i.category}:${i.label.toLowerCase()}`;
  return [item, ...items.filter((i) => i.id !== item.id && key(i) !== key(item))].slice(0, MAX_CUSTOM_ITEMS);
}

/** Parse stored items, dropping anything malformed instead of failing. */
export function parseStored(raw: string | null): CustomItem[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (i): i is CustomItem =>
        i && typeof i.id === 'string' && typeof i.label === 'string' && typeof i.factor === 'number' && i.factor >= 0 &&
        ['travel', 'food', 'electricity', 'shopping', 'waste'].includes(i.category) && ['km', 'kWh', 'item'].includes(i.unit),
    ).slice(0, MAX_CUSTOM_ITEMS);
  } catch {
    return [];
  }
}

export function loadCustomItems(): CustomItem[] {
  try {
    return parseStored(localStorage.getItem(CUSTOM_ITEMS_KEY));
  } catch {
    return [];
  }
}

export function saveCustomItems(items: CustomItem[]): void {
  try {
    localStorage.setItem(CUSTOM_ITEMS_KEY, JSON.stringify(items));
  } catch {
    /* storage full or blocked — the item still logs, it just isn't remembered */
  }
}
