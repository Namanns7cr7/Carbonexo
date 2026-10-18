/**
 * Example trips for the Living Earth's travel layer.
 *
 * City coordinates are real. Emissions use the same per-km factors as the Track
 * screen (TRACK_OPTIONS via story.factorOf), so the planet and the tracker
 * can never disagree.
 *
 * Distance is the great-circle (straight-line) distance. Roads and rails run
 * longer than that, so ground-mode figures are a lower bound — the UI says so.
 */

import { angularDistance, type LatLon } from './geo';
import { factorOf } from '../story';
import { countryByIso } from './countries';

export interface City {
  name: string;
  at: LatLon;
}

export type TripMode = 'Car ride' | 'Bus' | 'Metro / Train' | 'Flight';

export const MODE_META: Record<TripMode, { short: string; emoji: string }> = {
  'Car ride': { short: 'Car', emoji: '🚗' },
  Bus: { short: 'Bus', emoji: '🚌' },
  'Metro / Train': { short: 'Train', emoji: '🚆' },
  Flight: { short: 'Flight', emoji: '✈️' },
};

export interface Trip {
  id: string;
  from: City;
  to: City;
  /** Modes that genuinely serve this route. */
  modes: TripMode[];
}

const C = {
  mumbai: { name: 'Mumbai', at: { lat: 19.076, lon: 72.8777 } },
  pune: { name: 'Pune', at: { lat: 18.5204, lon: 73.8567 } },
  delhi: { name: 'New Delhi', at: { lat: 28.6139, lon: 77.209 } },
  jaipur: { name: 'Jaipur', at: { lat: 26.9124, lon: 75.7873 } },
  bengaluru: { name: 'Bengaluru', at: { lat: 12.9716, lon: 77.5946 } },
  chennai: { name: 'Chennai', at: { lat: 13.0827, lon: 80.2707 } },
  london: { name: 'London', at: { lat: 51.5074, lon: -0.1278 } },
  paris: { name: 'Paris', at: { lat: 48.8566, lon: 2.3522 } },
  nyc: { name: 'New York', at: { lat: 40.7128, lon: -74.006 } },
  dc: { name: 'Washington, D.C.', at: { lat: 38.9072, lon: -77.0369 } },
} satisfies Record<string, City>;

export const TRIPS: Trip[] = [
  { id: 'mum-pune', from: C.mumbai, to: C.pune, modes: ['Car ride', 'Bus', 'Metro / Train'] },
  { id: 'blr-maa', from: C.bengaluru, to: C.chennai, modes: ['Car ride', 'Bus', 'Metro / Train', 'Flight'] },
  { id: 'del-bom', from: C.delhi, to: C.mumbai, modes: ['Car ride', 'Metro / Train', 'Flight'] },
  { id: 'lon-par', from: C.london, to: C.paris, modes: ['Car ride', 'Metro / Train', 'Flight'] },
  { id: 'nyc-dc', from: C.nyc, to: C.dc, modes: ['Car ride', 'Bus', 'Metro / Train', 'Flight'] },
  { id: 'del-lon', from: C.delhi, to: C.london, modes: ['Flight'] },
];

/** Longest trip for which a road or rail journey is offered; beyond this only a flight is. */
const GROUND_MAX_KM = 3000;

/**
 * Id of a country-to-country trip: `FROM-TO` ISO codes, e.g. `IND-GBR`. While only one end
 * is chosen the other part is empty (`IND-`, `-GBR`), so a half-made choice survives re-renders.
 */
export function countryTripId(fromIso: string | null, toIso: string | null): string {
  return `${fromIso ?? ''}-${toIso ?? ''}`;
}

/** Splits a country trip id into its two ISO codes; example-trip ids and '' give nulls. */
export function parseCountryTripId(id: string): { from: string | null; to: string | null } {
  const m = /^([A-Z]{3})?-([A-Z]{3})?$/.exec(id);
  return m ? { from: m[1] ?? null, to: m[2] ?? null } : { from: null, to: null };
}

/**
 * A trip between two countries' capitals. Road and rail are offered only when both
 * are on the same landmass and within GROUND_MAX_KM (the figure assumes a link
 * exists); every trip can be flown.
 */
export function countryTrip(fromIso: string, toIso: string): Trip | null {
  const a = countryByIso(fromIso);
  const b = countryByIso(toIso);
  if (!a || !b || a.iso === b.iso) return null;
  const trip: Trip = {
    id: countryTripId(a.iso, b.iso),
    from: { name: a.name, at: a.at },
    to: { name: b.name, at: b.at },
    modes: ['Flight'],
  };
  if (a.land === b.land && tripKm(trip) <= GROUND_MAX_KM) trip.modes = ['Car ride', 'Bus', 'Metro / Train', 'Flight'];
  return trip;
}

/** The trip for a selection id: a country pair, an example trip, or null when nothing valid is chosen. */
export function resolveTrip(id: string): Trip | null {
  const { from, to } = parseCountryTripId(id);
  if (from || to || id === '-') return from && to ? countryTrip(from, to) : null;
  return TRIPS.find((t) => t.id === id) ?? null;
}

const KM_PER_DEG = 111.195; // mean Earth radius 6371.0 km × π / 180

/** Great-circle distance in km, rounded. */
export function tripKm(t: Trip): number {
  return Math.round(angularDistance(t.from.at, t.to.at) * KM_PER_DEG);
}

/** kg CO₂e, one way, one person, using the tracker's factor for `mode`. */
export function tripKg(t: Trip, mode: TripMode): number {
  return Math.round(tripKm(t) * factorOf('travel', mode) * 10) / 10;
}

/** Every mode on a trip, cheapest first — for the comparison bars. */
export function compareModes(t: Trip): { mode: TripMode; kg: number }[] {
  return t.modes.map((mode) => ({ mode, kg: tripKg(t, mode) })).sort((a, b) => a.kg - b.kg);
}

/** Camera framing for a trip: look at the arc's midpoint, back off with its length. */
export function tripView(t: Trip): { at: LatLon; distance: number } {
  const deg = angularDistance(t.from.at, t.to.at);
  // Midpoint on the great circle (a plain lat/lon average breaks across the antimeridian).
  const toV = ({ lat, lon }: LatLon) => {
    const la = (lat * Math.PI) / 180;
    const lo = (lon * Math.PI) / 180;
    return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  };
  const a = toV(t.from.at);
  const b = toV(t.to.at);
  const m = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const n = Math.hypot(m[0], m[1], m[2]) || 1;
  const at = { lat: (Math.asin(m[2] / n) * 180) / Math.PI, lon: (Math.atan2(m[1], m[0]) * 180) / Math.PI };
  return { at, distance: Math.min(4.4, 2.05 + deg / 28) };
}
