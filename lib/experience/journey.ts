/**
 * The landing journey's camera path.
 *
 * Five scenes, one planet. Each scene has a camera keyframe; scroll position
 * interpolates between neighbouring keyframes, and the GlobeBody springs
 * after the result. So scroll *drives* the camera along a path — it doesn't
 * trigger canned animations — and the spring keeps it from ever snapping.
 *
 * Pure: no DOM, no React.
 */

import type { GlobeAnchor } from '../physics/globe';
import { nearestAngle } from '../physics/spring';

export const SCENES = ['planet', 'world', 'footprint', 'impact', 'future'] as const;
export type SceneId = (typeof SCENES)[number];

export interface Keyframe {
  lat: number;
  lon: number;
  dist: number;
  frameX: number;
  frameY: number;
  /** Idle orbit, deg/s. */
  drift: number;
  /** 0 … 1 darkening over the planet, so copy always sits on a calm field. */
  dim: number;
}

export interface JourneyContext {
  /** Viewer's approximate longitude (from their UTC offset) — the story starts over their side of the world. */
  homeLon: number;
  /** Longitude of the morning terminator right now. The opening frame sits just sunward of it: daylight, with dawn on the limb. */
  sunriseLon: number;
  /** Portrait / narrow viewport: planet stacks above copy instead of beside it. Narrow distances assume a square frame; the page scales them by 1/aspect in portrait (see portraitScale). */
  narrow: boolean;
}

/** Approximate home longitude from the UTC offset: 15° per hour. */
export function homeLongitude(timezoneOffsetMinutes: number): number {
  const lon = (-timezoneOffsetMinutes / 60) * 15;
  return Math.max(-180, Math.min(180, lon));
}

export function keyframes({ homeLon, sunriseLon, narrow }: JourneyContext): Record<SceneId, Keyframe> {
  if (narrow) {
    return {
      planet: { lat: 14, lon: sunriseLon + 40, dist: 5.0, frameX: 0, frameY: 0.34, drift: 2, dim: 0.05 },
      world: { lat: 20, lon: homeLon, dist: 3.4, frameX: 0, frameY: 0.3, drift: 0, dim: 0 },
      footprint: { lat: 8, lon: homeLon + 30, dist: 4.6, frameX: 0, frameY: 0.3, drift: 1.2, dim: 0.55 },
      impact: { lat: -6, lon: homeLon + 60, dist: 4.8, frameX: 0, frameY: 0.3, drift: 1.2, dim: 0.6 },
      future: { lat: 8, lon: sunriseLon, dist: 2.9, frameX: 0, frameY: 0.1, drift: 1, dim: 0.42 },
    };
  }
  return {
    planet: { lat: 14, lon: sunriseLon + 40, dist: 3.9, frameX: 0.24, frameY: 0, drift: 2, dim: 0 },
    world: { lat: 20, lon: homeLon, dist: 2.75, frameX: 0.2, frameY: 0, drift: 0, dim: 0 },
    footprint: { lat: 8, lon: homeLon + 30, dist: 6.2, frameX: -0.34, frameY: 0, drift: 1.2, dim: 0.35 },
    impact: { lat: -6, lon: homeLon + 60, dist: 5.8, frameX: 0.3, frameY: 0, drift: 1.2, dim: 0.4 },
    future: { lat: 8, lon: sunriseLon, dist: 2.35, frameX: 0, frameY: -0.24, drift: 1, dim: 0.35 },
  };
}

/**
 * In a portrait frame the horizontal field of view is the narrow one, so the
 * camera backs off by 1/aspect to keep the planet's width in shot.
 */
export function portraitScale(aspect: number): number {
  return aspect > 0 && aspect < 1 ? 1 / aspect : 1;
}

/**
 * Where the viewport is in the story: `index` of the scene whose centre is
 * at or above the viewport centre, and `t` ∈ [0,1) toward the next one.
 * `centers` are the scenes' vertical centres in page coordinates.
 */
export function storyPosition(centers: number[], viewportCenter: number): { index: number; t: number } {
  if (centers.length === 0) return { index: 0, t: 0 };
  if (viewportCenter <= centers[0]) return { index: 0, t: 0 };
  for (let i = 0; i < centers.length - 1; i++) {
    if (viewportCenter < centers[i + 1]) {
      const span = centers[i + 1] - centers[i];
      return { index: i, t: span > 0 ? (viewportCenter - centers[i]) / span : 0 };
    }
  }
  return { index: centers.length - 1, t: 0 };
}

/** Smoothstep — scenes hold their framing near their centre and travel in between. */
function ease(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** Interpolated camera for a story position. Longitude takes the short way round. */
export function blend(a: Keyframe, b: Keyframe, t: number): Keyframe {
  const k = ease(t);
  const lerp = (x: number, y: number) => x + (y - x) * k;
  const bLon = nearestAngle((a.lon * Math.PI) / 180, (b.lon * Math.PI) / 180) * (180 / Math.PI);
  return {
    lat: lerp(a.lat, b.lat),
    lon: lerp(a.lon, bLon),
    dist: lerp(a.dist, b.dist),
    frameX: lerp(a.frameX, b.frameX),
    frameY: lerp(a.frameY, b.frameY),
    drift: lerp(a.drift, b.drift),
    dim: lerp(a.dim, b.dim),
  };
}

/** The anchor for a story position. The key is the nearest scene, so a user's drag holds until they scroll into the next scene. */
export function anchorAt(frames: Record<SceneId, Keyframe>, pos: { index: number; t: number }): { anchor: GlobeAnchor; dim: number; scene: SceneId } {
  const i = Math.max(0, Math.min(SCENES.length - 1, pos.index));
  const j = Math.min(SCENES.length - 1, i + 1);
  const kf = blend(frames[SCENES[i]], frames[SCENES[j]], pos.t);
  const scene = SCENES[pos.t < 0.5 ? i : j];
  const { dim, ...cam } = kf;
  return { anchor: { key: `scene:${scene}`, ...cam }, dim, scene };
}
