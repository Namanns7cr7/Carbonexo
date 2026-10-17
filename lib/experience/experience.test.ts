import { describe, it, expect } from 'vitest';
import { latLonToVec3, vec3ToLatLon, angularDistance, slerpLatLon, easeInOutCubic, flightSeconds } from './geo';
import { solarDeclination, equationOfTime, subsolarPoint } from './sun';
import { COUNTRY_CO2, CO2_DATA_YEAR, co2Intensity, co2Color } from './co2';
import { REGIONS, ALL_STOPS } from './regions';
import { earthQuality } from './quality';
import { niceMax, lineGeometry, trend, goalStatus, formatKg, weekdayLabel } from './viz';
import { SAMPLE_CREDITS, SAMPLE_RETIREMENTS } from './fixtures';

const close = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('geo', () => {
  it('matches three.js SphereGeometry UV layout: lat 0 / lon 0 faces +x, the north pole is +y', () => {
    const [x, y, z] = latLonToVec3({ lat: 0, lon: 0 });
    close(x, 1); close(y, 0); close(z, 0);
    close(latLonToVec3({ lat: 90, lon: 0 })[1], 1);
  });

  it('round-trips coordinates', () => {
    for (const p of [{ lat: 28.6, lon: 77.2 }, { lat: -33.9, lon: 151.2 }, { lat: 64.1, lon: -21.9 }, { lat: 0, lon: 179.5 }]) {
      const back = vec3ToLatLon(latLonToVec3(p, 2.5));
      close(back.lat, p.lat, 1e-9);
      close(back.lon, p.lon, 1e-9);
    }
  });

  it('measures great-circle distance', () => {
    close(angularDistance({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }), 90, 1e-9);
    close(angularDistance({ lat: 90, lon: 0 }, { lat: -90, lon: 0 }), 180, 1e-6);
  });

  it('slerps along the great circle, hitting both endpoints', () => {
    const a = { lat: 10, lon: -60 };
    const b = { lat: 30, lon: 80 };
    const s0 = slerpLatLon(a, b, 0);
    const s1 = slerpLatLon(a, b, 1);
    close(s0.lat, a.lat, 1e-9); close(s0.lon, a.lon, 1e-9);
    close(s1.lat, b.lat, 1e-9); close(s1.lon, b.lon, 1e-9);
    const mid = slerpLatLon(a, b, 0.5);
    close(angularDistance(a, mid), angularDistance(mid, b), 1e-6);
  });

  it('eases and scales flights', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    close(easeInOutCubic(0.5), 0.5);
    expect(flightSeconds({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })).toBeGreaterThan(flightSeconds({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }));
  });
});

describe('sun', () => {
  it('puts the Sun over the Tropic of Cancer at the June solstice', () => {
    close(solarDeclination(new Date(Date.UTC(2025, 5, 21, 12))), 23.44, 0.3);
  });

  it('puts the Sun over the equator at the March equinox', () => {
    // Declination moves ~0.4°/day here, so the low-precision series is at its
    // least accurate; ~0.5° is still invisible at globe scale.
    close(solarDeclination(new Date(Date.UTC(2025, 2, 20, 9))), 0, 0.75);
  });

  it('puts the Sun over the Tropic of Capricorn at the December solstice', () => {
    close(solarDeclination(new Date(Date.UTC(2025, 11, 21, 15))), -23.44, 0.3);
  });

  it('tracks the equation of time (Sun about 16 min fast in early November)', () => {
    close(equationOfTime(new Date(Date.UTC(2025, 10, 3, 12))), 16.4, 0.6);
  });

  it('places noon at Greenwich near 12:00 UTC, shifted by the equation of time', () => {
    const p = subsolarPoint(new Date(Date.UTC(2025, 10, 3, 12)));
    close(p.lon, -4.1, 0.3);
  });

  it('moves the subsolar point 15° west per hour', () => {
    const a = subsolarPoint(new Date(Date.UTC(2025, 3, 15, 10)));
    const b = subsolarPoint(new Date(Date.UTC(2025, 3, 15, 11)));
    close(a.lon - b.lon, 15, 0.05);
  });

  it('keeps longitude in range', () => {
    for (let h = 0; h < 24; h++) {
      const { lon } = subsolarPoint(new Date(Date.UTC(2025, 0, 1, h)));
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThan(180);
    }
  });
});

describe('co2 overlay data', () => {
  it('is a dated, non-empty, de-duplicated table with sane values', () => {
    expect(CO2_DATA_YEAR).toBeGreaterThanOrEqual(2022);
    expect(new Set(COUNTRY_CO2.map((c) => c.iso)).size).toBe(COUNTRY_CO2.length);
    for (const c of COUNTRY_CO2) {
      expect(c.perCapita).toBeGreaterThan(0);
      expect(c.perCapita).toBeLessThan(60);
      expect(Math.abs(c.at.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.at.lon)).toBeLessThanOrEqual(180);
    }
  });

  it('scales intensity 0..1 with the largest emitter at 1', () => {
    const max = Math.max(...COUNTRY_CO2.map((c) => c.perCapita));
    expect(co2Intensity(max)).toBe(1);
    expect(co2Intensity(0)).toBe(0);
    expect(co2Intensity(max / 4)).toBeCloseTo(0.5, 6);
  });

  it('produces a valid colour across the range', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) expect(co2Color(t)).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });
});

describe('regions and quality', () => {
  it('has unique tour stops with real coordinates', () => {
    expect(new Set(ALL_STOPS.map((r) => r.id)).size).toBe(ALL_STOPS.length);
    for (const r of REGIONS) expect(r.distance).toBeGreaterThan(1.2);
  });

  it('never mounts WebGL below the full tier', () => {
    expect(earthQuality('still').webgl).toBe(false);
    expect(earthQuality('lite').webgl).toBe(false);
    expect(earthQuality('full').webgl).toBe(true);
  });

  it('gives touch devices a lighter budget', () => {
    const desk = earthQuality('full');
    const touch = earthQuality('full', { coarsePointer: true });
    expect(touch.texture).toBe('2k');
    expect(touch.dpr[1]).toBeLessThan(desk.dpr[1]);
  });
});

describe('viz', () => {
  it('rounds axis maxima to readable steps', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7.3)).toBe(10);
    expect(niceMax(10.2)).toBe(20);
    expect(niceMax(23)).toBe(25);
    expect(niceMax(0.42)).toBe(0.5);
  });

  it('lays a series out inside its box', () => {
    const g = lineGeometry([{ date: '2026-10-01', kg: 0 }, { date: '2026-10-02', kg: 10 }], 100, 50, 5);
    expect(g.max).toBe(10);
    expect(g.points[0]).toMatchObject({ x: 5, y: 45 });
    expect(g.points[1]).toMatchObject({ x: 95, y: 5 });
    expect(g.line).toBe('M5 45 L95 5');
    expect(g.area.endsWith('Z')).toBe(true);
  });

  it('handles an empty series', () => {
    expect(lineGeometry([], 100, 50).line).toBe('');
  });

  it('reports trend between the halves of a series', () => {
    const s = [10, 10, 8, 8].map((kg, i) => ({ date: `2026-10-0${i + 1}`, kg }));
    expect(trend(s)).toBeCloseTo(-0.2, 6);
    expect(trend(s.slice(0, 1))).toBeNull();
  });

  it('classifies budget goals', () => {
    const g = { id: 'g', label: 'g', period: 'week' as const, budgetKg: 70 };
    expect(goalStatus({ ...g, usedKg: 30, elapsed: 0.5 })).toBe('on-pace');
    expect(goalStatus({ ...g, usedKg: 50, elapsed: 0.5 })).toBe('at-risk');
    expect(goalStatus({ ...g, usedKg: 71, elapsed: 0.5 })).toBe('over');
    expect(goalStatus({ ...g, usedKg: 69, elapsed: 1 })).toBe('met');
  });

  it('formats masses', () => {
    expect(formatKg(6.44)).toBe('6.4 kg');
    expect(formatKg(240.4)).toBe('240 kg');
    expect(formatKg(1530)).toBe('1.5 t');
  });

  it('labels weekdays without UTC drift', () => {
    expect(weekdayLabel('2026-10-15')).toBe('Thu');
  });
});

describe('fixtures', () => {
  it('cannot be mistaken for real registry records', () => {
    for (const c of SAMPLE_CREDITS) {
      expect(c.registry).toMatch(/sample/i);
      expect(c.projectId).toMatch(/^SAMPLE-/);
      expect(c.registryUrl ?? '').toMatch(/^https:\/\/example\.org\//);
    }
    for (const r of SAMPLE_RETIREMENTS) expect(r.serialRange).toMatch(/^SAMPLE-/);
  });
});
