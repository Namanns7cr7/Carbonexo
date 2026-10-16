/**
 * Where the Sun is overhead right now — the subsolar point.
 *
 * The Living Earth's day/night terminator is driven by this, so the lit half
 * of the globe matches the real world at the moment the page is viewed. It is
 * genuine astronomy (NOAA's low-precision solar position: declination and the
 * equation of time from the fractional year). Error is a fraction of a degree —
 * largest near the equinoxes, where it can reach ~0.5° — far finer than a
 * terminator can be seen at globe scale.
 */

import type { LatLon } from './geo';

const DEG = Math.PI / 180;

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Fractional year in radians (NOAA γ). */
function fractionalYear(date: Date): number {
  const y = date.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - start) / 86_400_000) + 1;
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return ((2 * Math.PI) / (isLeapYear(y) ? 366 : 365)) * (dayOfYear - 1 + (hour - 12) / 24);
}

/** Solar declination in degrees. */
export function solarDeclination(date: Date): number {
  const g = fractionalYear(date);
  const rad =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  return rad / DEG;
}

/** Equation of time in minutes (apparent − mean solar time). */
export function equationOfTime(date: Date): number {
  const g = fractionalYear(date);
  return (
    229.18 *
    (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g))
  );
}

/** The point on Earth where the Sun is at the zenith at `date`. */
export function subsolarPoint(date: Date = new Date()): LatLon {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  // Solar noon happens at longitude where local apparent time is 12:00.
  let lon = -((utcMinutes + equationOfTime(date) - 720) / 4);
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat: solarDeclination(date), lon };
}
