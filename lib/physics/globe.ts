/**
 * The globe camera as a physical body.
 *
 * The camera orbits the planet on a sphere described by (lon, lat, dist). The
 * planet itself never rotates: the sun direction is fixed in world space, so
 * moving the camera keeps the day/night terminator where it really is.
 *
 * Three modes, one continuous velocity:
 *
 *  follow — springs toward an anchor (a story scene, a selected region). An
 *           anchor may carry `drift`, a slow idle orbit; the drift accumulates
 *           as an offset so the spring tracks a moving target, and when the
 *           next anchor has none the offset bleeds away instead of snapping.
 *  drag   — the surface under the pointer follows the pointer. Release
 *           velocity is measured with a short exponential average.
 *  free   — after a release (or a keyboard nudge) the planet glides on its
 *           momentum, with friction, and winds back up to the anchor's drift.
 *           It stays free until the anchor changes, so a user's chosen view
 *           is never yanked away by an idle timer.
 *
 * Velocities are shared across modes, so every hand-off is seamless: a fling
 * becomes a glide, a new anchor bends the glide into a flight.
 *
 * Pure TypeScript; the R3F rig calls `step()` from useFrame and copies
 * `position()` onto the camera.
 */

import { SPRINGS, approach, clamp, decay, nearestAngle, rubberBand, stepSpring, wrapAngle, type SpringState } from './spring';

const DEG = Math.PI / 180;

export interface GlobeAnchor {
  /** Changing the key re-engages `follow` and resets user zoom. Same key = same intent, just a moved target. */
  key: string;
  lat: number;
  lon: number;
  /** Camera distance from the centre, in globe radii. */
  dist: number;
  /** Idle orbit, degrees per second, eastward-positive. 0 or absent = still. */
  drift?: number;
  /** Horizontal framing: −0.5 … 0.5 of the viewport width to shift the planet by (positive = right). */
  frameX?: number;
  /** Vertical framing: −0.5 … 0.5 of the viewport height (positive = up). */
  frameY?: number;
}

export interface GlobeLimits {
  minDist: number;
  maxDist: number;
  /** Absolute latitude limit for the camera, degrees. */
  maxLat: number;
}

export const DEFAULT_LIMITS: GlobeLimits = { minDist: 1.55, maxDist: 9, maxLat: 78 };

/** Friction for free glides, 1/s. ~1.6 gives a fling that coasts ~1.5 s — heavy, not slippery. */
const GLIDE_FRICTION = 1.6;
/** Max angular speed a fling can impart, rad/s. */
const MAX_SPIN = 5;
/** A pointer held still this long before release is a placement, not a throw. */
const HOLD_MS = 90;
/** Velocity-estimate time constant during a drag, seconds. */
const VEL_TAU = 0.045;

export class GlobeBody {
  /** Radians. Longitude is unbounded internally (wrapped only on output) so velocity never sees a discontinuity. */
  lon: number;
  lat: number;
  vLon = 0;
  vLat = 0;
  readonly distS: SpringState;
  readonly frameS: SpringState;
  readonly frameYS: SpringState;
  mode: 'follow' | 'drag' | 'free' = 'follow';

  private anchor: GlobeAnchor;
  private driftOffset = 0;
  /** User zoom multiplier on the anchor distance; springs reset to 1 on a new anchor. */
  private zoom = 1;
  private lastMoveAt = 0;
  readonly limits: GlobeLimits;

  constructor(anchor: GlobeAnchor, limits: GlobeLimits = DEFAULT_LIMITS) {
    this.anchor = anchor;
    this.limits = limits;
    this.lon = anchor.lon * DEG;
    this.lat = anchor.lat * DEG;
    this.distS = { x: anchor.dist, v: 0 };
    this.frameS = { x: anchor.frameX ?? 0, v: 0 };
    this.frameYS = { x: anchor.frameY ?? 0, v: 0 };
  }

  setAnchor(a: GlobeAnchor) {
    if (a.key !== this.anchor.key) {
      if (this.mode !== 'drag') this.mode = 'follow';
      this.zoom = 1;
    }
    this.anchor = a;
  }

  /** Hand the camera back to the anchor without changing it (e.g. a "recentre" control). */
  recenter() {
    this.mode = 'follow';
    this.zoom = 1;
  }

  beginDrag(now: number) {
    this.mode = 'drag';
    this.vLon = 0;
    this.vLat = 0;
    this.lastMoveAt = now;
  }

  /**
   * Pointer moved by (dx, dy) px over `dt` s. The angle per pixel is the size
   * of one pixel at the globe's near surface, so the point under the finger
   * stays under the finger — the planet feels held, not steered.
   */
  drag(dx: number, dy: number, dt: number, viewportH: number, fovDeg: number, now: number) {
    if (this.mode !== 'drag') return;
    const surfaceDepth = Math.max(0.35, this.distS.x - 1);
    const radPerPx = (2 * surfaceDepth * Math.tan((fovDeg * DEG) / 2)) / Math.max(1, viewportH);
    const dLon = -dx * radPerPx / Math.max(0.2, Math.cos(this.lat));
    const dLat = dy * radPerPx;

    this.lon += dLon;
    const maxLat = this.limits.maxLat * DEG;
    this.lat = rubberBand(this.lat + dLat, -maxLat, maxLat, 8 * DEG);

    if (dt > 0) {
      const k = 1 - Math.exp(-dt / VEL_TAU);
      this.vLon += (dLon / dt - this.vLon) * k;
      this.vLat += (dLat / dt - this.vLat) * k;
    }
    this.lastMoveAt = now;
  }

  endDrag(now: number) {
    if (this.mode !== 'drag') return;
    if (now - this.lastMoveAt > HOLD_MS) {
      this.vLon = 0;
      this.vLat = 0;
    }
    this.vLon = clamp(this.vLon, -MAX_SPIN, MAX_SPIN);
    this.vLat = clamp(this.vLat, -MAX_SPIN, MAX_SPIN);
    this.mode = 'free';
  }

  /** Keyboard / button impulse, rad/s added to the current velocity. */
  nudge(dvLon: number, dvLat: number) {
    if (this.mode === 'drag') return;
    this.mode = 'free';
    this.vLon = clamp(this.vLon + dvLon, -MAX_SPIN, MAX_SPIN);
    this.vLat = clamp(this.vLat + dvLat, -MAX_SPIN, MAX_SPIN);
  }

  /** Multiply the user zoom (factor < 1 = closer). Clamped against the limits with a little give. */
  zoomBy(factor: number) {
    const base = this.anchor.dist;
    const { minDist, maxDist } = this.limits;
    const next = clamp(base * this.zoom * factor, minDist * 0.94, maxDist * 1.06);
    this.zoom = next / base;
  }

  step(dt: number) {
    const a = this.anchor;
    const drift = (a.drift ?? 0) * DEG;
    const maxLat = this.limits.maxLat * DEG;

    if (drift !== 0) this.driftOffset = wrapAngle(this.driftOffset + drift * dt);
    else this.driftOffset = approach(this.driftOffset, 0, 0.8, dt);

    let gap = 0;
    if (this.mode === 'follow') {
      const lonS = { x: this.lon, v: this.vLon };
      const latS = { x: this.lat, v: this.vLat };
      const tLon = nearestAngle(this.lon, a.lon * DEG + this.driftOffset);
      const tLat = clamp(a.lat, -this.limits.maxLat, this.limits.maxLat) * DEG;
      stepSpring(lonS, tLon, SPRINGS.camera, dt);
      stepSpring(latS, tLat, SPRINGS.camera, dt);
      this.lon = lonS.x;
      this.vLon = lonS.v;
      this.lat = latS.x;
      this.vLat = latS.v;
      gap = Math.hypot((tLon - this.lon) * Math.cos(this.lat), tLat - this.lat);
    } else if (this.mode === 'free') {
      // Momentum with friction; longitude winds back up to the anchor's drift.
      this.vLon = drift + decay(this.vLon - drift, GLIDE_FRICTION, dt);
      this.vLat = decay(this.vLat, GLIDE_FRICTION, dt);
      this.lon += this.vLon * dt;
      this.lat += this.vLat * dt;
    }

    // Latitude past the limit (from a drag overshoot or a glide) springs back.
    if (this.mode !== 'drag' && Math.abs(this.lat) > maxLat) {
      const s = { x: this.lat, v: this.vLat };
      stepSpring(s, Math.sign(this.lat) * maxLat, SPRINGS.limit, dt);
      this.lat = s.x;
      this.vLat = s.v;
    }

    // Long flights pull back mid-way, so a hop across the planet reads as travel.
    const lift = Math.min(0.9, gap * 0.45);
    const { minDist, maxDist } = this.limits;
    const distTarget = clamp(a.dist * this.zoom, minDist, maxDist) + lift;
    stepSpring(this.distS, distTarget, SPRINGS.zoom, dt);
    stepSpring(this.frameS, a.frameX ?? 0, SPRINGS.camera, dt);
    stepSpring(this.frameYS, a.frameY ?? 0, SPRINGS.camera, dt);
  }

  /** Camera latitude/longitude in degrees, longitude wrapped to (−180, 180]. */
  latLon(): { lat: number; lon: number } {
    return { lat: this.lat / DEG, lon: wrapAngle(this.lon) / DEG };
  }

  /** Total angular speed, rad/s — for motion-aware effects (e.g. hiding labels mid-fling). */
  speed(): number {
    return Math.hypot(this.vLon * Math.cos(this.lat), this.vLat);
  }
}
