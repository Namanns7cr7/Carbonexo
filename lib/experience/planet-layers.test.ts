import { describe, expect, it } from 'vitest';
import { COUNTRY_CO2 } from './co2';
import { GRID_INTENSITY, WORLD_GRID, gridColor, gridIntensity01, kgForKwh } from './grid';
import { TRIPS, compareModes, tripKg, tripKm, tripView } from './trips';
import { SCENES, anchorAt, blend, homeLongitude, keyframes, portraitScale, storyPosition } from './journey';

describe('grid layer', () => {
  it('covers every country on the CO₂ layer, so markers share positions', () => {
    for (const c of COUNTRY_CO2) expect(GRID_INTENSITY[c.iso], c.iso).toBeDefined();
  });

  it('values are plausible g/kWh for a recent year', () => {
    for (const [iso, v] of Object.entries(GRID_INTENSITY)) {
      expect(v.g, iso).toBeGreaterThan(0);
      expect(v.g, iso).toBeLessThan(1200);
      expect(v.year, iso).toBeGreaterThanOrEqual(2023);
    }
    expect(WORLD_GRID.g).toBeGreaterThan(300);
  });

  it('cleaner grids rank below dirtier ones (spot check against the source)', () => {
    expect(GRID_INTENSITY.FRA.g).toBeLessThan(GRID_INTENSITY.DEU.g);
    expect(GRID_INTENSITY.NOR.g).toBeLessThan(GRID_INTENSITY.IND.g);
  });

  it('colour ramp and kWh conversion', () => {
    expect(gridIntensity01(0)).toBe(0);
    expect(gridIntensity01(5000)).toBe(1);
    expect(gridColor(0)).toBe('rgb(95,212,196)');
    expect(gridColor(1)).toBe('rgb(231,111,81)');
    expect(kgForKwh(6, 500)).toBe(3);
  });
});

describe('trips', () => {
  it('great-circle distances match known values within 2%', () => {
    const lonPar = TRIPS.find((t) => t.id === 'lon-par')!;
    const delLon = TRIPS.find((t) => t.id === 'del-lon')!;
    expect(Math.abs(tripKm(lonPar) - 344) / 344).toBeLessThan(0.02);
    expect(Math.abs(tripKm(delLon) - 6716) / 6716).toBeLessThan(0.02);
  });

  it('emissions use the tracker factors (flight 0.25, train 0.04 kg/km)', () => {
    const t = TRIPS.find((x) => x.id === 'del-bom')!;
    expect(tripKg(t, 'Flight')).toBeCloseTo(tripKm(t) * 0.25, 0);
    expect(tripKg(t, 'Metro / Train')).toBeCloseTo(tripKm(t) * 0.04, 0);
  });

  it('comparison is sorted cleanest first and only offers modes that serve the route', () => {
    for (const t of TRIPS) {
      const c = compareModes(t);
      expect(c.map((x) => x.mode).sort()).toEqual([...t.modes].sort());
      for (let i = 1; i < c.length; i++) expect(c[i].kg).toBeGreaterThanOrEqual(c[i - 1].kg);
    }
    expect(TRIPS.find((t) => t.id === 'del-lon')!.modes).toEqual(['Flight']);
  });

  it('frames the arc midpoint, farther out for longer trips', () => {
    const short = tripView(TRIPS.find((t) => t.id === 'mum-pune')!);
    const long = tripView(TRIPS.find((t) => t.id === 'del-lon')!);
    expect(long.distance).toBeGreaterThan(short.distance);
    expect(short.at.lat).toBeGreaterThan(18);
    expect(short.at.lat).toBeLessThan(19.2);
  });
});

describe('journey camera path', () => {
  const ctx = { homeLon: 82.5, sunriseLon: -40, narrow: false };
  const frames = keyframes(ctx);

  it('home longitude from UTC offset (IST = −330 min → 82.5°E)', () => {
    expect(homeLongitude(-330)).toBe(82.5);
    expect(homeLongitude(300)).toBe(-75);
  });

  it('story position: before, between and after scenes', () => {
    expect(storyPosition([100, 300, 500], 0)).toEqual({ index: 0, t: 0 });
    expect(storyPosition([100, 300, 500], 200)).toEqual({ index: 0, t: 0.5 });
    expect(storyPosition([100, 300, 500], 400)).toEqual({ index: 1, t: 0.5 });
    expect(storyPosition([100, 300, 500], 900)).toEqual({ index: 2, t: 0 });
  });

  it('blend hits keyframes exactly at the ends', () => {
    const a = frames.planet;
    const b = frames.world;
    expect(blend(a, b, 0)).toEqual(a);
    const end = blend(a, b, 1);
    expect(end.dist).toBeCloseTo(b.dist);
    expect(end.lat).toBeCloseTo(b.lat);
  });

  it('blend takes the short way across the antimeridian', () => {
    const a = { ...frames.planet, lon: 170 };
    const b = { ...frames.planet, lon: -170 };
    const mid = blend(a, b, 0.5);
    expect(Math.abs(mid.lon)).toBeCloseTo(180, 0);
  });

  it('anchor key is the nearest scene', () => {
    expect(anchorAt(frames, { index: 0, t: 0.2 }).scene).toBe('planet');
    expect(anchorAt(frames, { index: 0, t: 0.7 }).scene).toBe('world');
    expect(anchorAt(frames, { index: SCENES.length - 1, t: 0 }).anchor.key).toBe('scene:future');
  });

  it('narrow layout never shifts the planet sideways', () => {
    const n = keyframes({ ...ctx, narrow: true });
    for (const s of SCENES) expect(n[s].frameX).toBe(0);
  });

  it('portrait frames back the camera off by 1/aspect; landscape is untouched', () => {
    expect(portraitScale(390 / 844)).toBeCloseTo(844 / 390);
    expect(portraitScale(1440 / 900)).toBe(1);
    expect(portraitScale(0)).toBe(1);
  });
});
