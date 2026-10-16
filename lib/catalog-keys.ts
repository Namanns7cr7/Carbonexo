/**
 * Track catalog → emission-factor keys. The Track screen's options and the
 * backend's emission_factors rows share labels (V3 seeds them from this
 * catalog), so the key is looked up by category + label.
 */
import { DEFAULT_EMISSION_FACTORS } from './api/dashboard';
import type { Category, TrackOption } from './carbon';

export function factorKeyFor(category: Category, label: string): string | undefined {
  return DEFAULT_EMISSION_FACTORS.find((f) => f.category === category && f.label === label)?.factorKey;
}

/** The meta the store sends with a catalog log. */
export function logMetaFor(category: Category, opt: TrackOption, qty: number) {
  return { factorKey: factorKeyFor(category, opt.label), quantity: qty, unit: opt.unit ?? 'item' };
}
