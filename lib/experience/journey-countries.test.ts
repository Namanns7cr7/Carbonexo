import { describe, expect, it } from 'vitest';
import { JOURNEY_COUNTRIES, countryByIso } from './countries';
import { compareModes, countryTrip, countryTripId, parseCountryTripId, resolveTrip, tripKm } from './trips';

describe('journey countries', () => {
  it('lists each country once, sorted, with real coordinates', () => {
    const isos = JOURNEY_COUNTRIES.map((c) => c.iso);
    expect(new Set(isos).size).toBe(isos.length);
    expect(JOURNEY_COUNTRIES.length).toBeGreaterThanOrEqual(70);
    const names = JOURNEY_COUNTRIES.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    for (const c of JOURNEY_COUNTRIES) {
      expect(Math.abs(c.at.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.at.lon)).toBeLessThanOrEqual(180);
    }
    for (const iso of ['IND', 'USA', 'CHN', 'GBR', 'JPN', 'BRA', 'AUS', 'ZAF', 'DEU', 'FRA']) expect(countryByIso(iso)).toBeDefined();
  });

  it('measures capital-to-capital distance', () => {
    const deluk = countryTrip('IND', 'GBR')!;
    expect(Math.abs(tripKm(deluk) - 6711) / 6711).toBeLessThan(0.02);
    const frDe = countryTrip('FRA', 'DEU')!;
    expect(Math.abs(tripKm(frDe) - 878) / 878).toBeLessThan(0.03);
  });

  it('offers road and rail only where a land link can exist and the trip is not huge', () => {
    expect(countryTrip('FRA', 'DEU')!.modes).toContain('Metro / Train');
    expect(countryTrip('USA', 'CAN')!.modes).toContain('Car ride');
    expect(countryTrip('IND', 'GBR')!.modes).toEqual(['Flight']); // far apart
    expect(countryTrip('GBR', 'FRA')!.modes).toEqual(['Flight']); // across water
    expect(countryTrip('IND', 'AUS')!.modes).toEqual(['Flight']);
    expect(countryTrip('BRA', 'RUS')!.modes).toEqual(['Flight']); // different landmasses
    expect(countryTrip('KOR', 'JPN')!.modes).toEqual(['Flight']);
  });

  it('prices every mode with the tracker factors, cheapest first', () => {
    const modes = compareModes(countryTrip('FRA', 'DEU')!);
    expect(modes.map((m) => m.kg)).toEqual([...modes.map((m) => m.kg)].sort((a, b) => a - b));
    expect(modes[0].mode).toBe('Metro / Train');
    expect(modes[modes.length - 1].mode).toBe('Flight');
  });

  it('rejects unknown or identical countries', () => {
    expect(countryTrip('IND', 'IND')).toBeNull();
    expect(countryTrip('IND', 'XXX')).toBeNull();
  });

  it('round-trips ids, including a half-made choice', () => {
    expect(parseCountryTripId(countryTripId('IND', 'GBR'))).toEqual({ from: 'IND', to: 'GBR' });
    expect(parseCountryTripId(countryTripId('IND', null))).toEqual({ from: 'IND', to: null });
    expect(parseCountryTripId(countryTripId(null, 'GBR'))).toEqual({ from: null, to: 'GBR' });
    expect(parseCountryTripId('')).toEqual({ from: null, to: null });
  });

  it('resolves a trip only when both ends are chosen; example ids still work', () => {
    expect(resolveTrip('IND-GBR')?.from.name).toBe('India');
    expect(resolveTrip('IND-')).toBeNull();
    expect(resolveTrip('-GBR')).toBeNull();
    expect(resolveTrip('')).toBeNull();
    expect(resolveTrip('lon-par')?.from.name).toBe('London');
  });
});
