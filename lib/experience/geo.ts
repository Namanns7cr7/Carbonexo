/**
 * Geographic math for the Living Earth.
 *
 * Coordinates are mapped to match three.js SphereGeometry's UV layout, so a
 * marker at (lat, lon) lands on the same pixel of an equirectangular texture
 * (u = 0 at lon −180°, v = 0 at the north pole) that the globe is wrapped in.
 *
 * Pure functions with plain tuples — no three.js import — so they are unit
 * testable under the `node` environment and usable on the server.
 */

export type Vec3 = [number, number, number];

export interface LatLon {
  /** Degrees, −90 (south) … 90 (north). */
  lat: number;
  /** Degrees, −180 (west) … 180 (east). */
  lon: number;
}

const DEG = Math.PI / 180;

/** Position on a sphere of radius `r` for a geographic coordinate. */
export function latLonToVec3({ lat, lon }: LatLon, r = 1): Vec3 {
  const phi = (lon + 180) * DEG; // azimuth, as SphereGeometry's u
  const theta = (90 - lat) * DEG; // polar angle, as SphereGeometry's v
  return [-r * Math.cos(phi) * Math.sin(theta), r * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta)];
}

/** Inverse of latLonToVec3. Longitude is normalised to (−180, 180]. */
export function vec3ToLatLon([x, y, z]: Vec3): LatLon {
  const r = Math.hypot(x, y, z) || 1;
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, y / r))) / DEG;
  let lon = Math.atan2(z, -x) / DEG - 180;
  if (lon <= -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}

export function normalize([x, y, z]: Vec3): Vec3 {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** Great-circle distance in degrees between two coordinates. */
export function angularDistance(a: LatLon, b: LatLon): number {
  const [ax, ay, az] = latLonToVec3(a);
  const [bx, by, bz] = latLonToVec3(b);
  return Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz))) / DEG;
}

/**
 * Spherical interpolation along the great circle from a to b, t ∈ [0, 1].
 * The camera flies this path between regions, so it arcs around the planet
 * instead of cutting through it.
 */
export function slerpLatLon(a: LatLon, b: LatLon, t: number): LatLon {
  const va = latLonToVec3(a);
  const vb = latLonToVec3(b);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-6) return { ...a };
  const s = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / s;
  const wb = Math.sin(t * omega) / s;
  return vec3ToLatLon([va[0] * wa + vb[0] * wb, va[1] * wa + vb[1] * wb, va[2] * wa + vb[2] * wb]);
}

/** Smooth start and stop for camera flights. */
export function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

/**
 * Flight duration in seconds, scaled by how far the camera travels so a hop
 * to a neighbouring country does not take as long as crossing the planet.
 */
export function flightSeconds(a: LatLon, b: LatLon, { min = 1.1, max = 2.6 } = {}): number {
  return min + (max - min) * (angularDistance(a, b) / 180);
}
