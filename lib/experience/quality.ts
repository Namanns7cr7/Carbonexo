/**
 * Render budget for the Living Earth, per motion tier.
 *
 * Tiers come from lib/motion.ts: `full` mounts WebGL, `lite` and `still` get
 * the static poster. A coarse-pointer `full` device still gets 2K textures and
 * a lower DPR cap — phones that pass the tier check are often thermally
 * limited, and 4K textures cost ~64 MB of GPU memory each once decoded.
 */

import type { MotionTier } from '../motion';

export interface EarthQuality {
  webgl: boolean;
  texture: '4k' | '2k';
  /** Sphere segments (width = 2 × height). */
  segments: number;
  /** Device pixel ratio clamp passed to the canvas. */
  dpr: [number, number];
  clouds: boolean;
  stars: number;
  /** Idle auto-rotation, radians per second. 0 = still. */
  spin: number;
}

export function earthQuality(
  tier: MotionTier,
  { coarsePointer = false, compact = false }: { coarsePointer?: boolean; compact?: boolean } = {}
): EarthQuality {
  if (tier !== 'full') {
    return { webgl: false, texture: '2k', segments: 0, dpr: [1, 1], clouds: false, stars: 0, spin: 0 };
  }
  // A phone, or a globe drawn as a panel rather than a hero: lightweight and battery-efficient
  if (coarsePointer || compact) {
    return { webgl: true, texture: '2k', segments: 80, dpr: [1, 1.25], clouds: true, stars: 1000, spin: 0.04 };
  }
  // Desktop: 2K texture loads instantly, uses 75% less VRAM and maintains smooth 60fps
  return { webgl: true, texture: '2k', segments: 112, dpr: [1, 1.5], clouds: true, stars: 1600, spin: 0.04 };
}

export const EARTH_TEXTURES = {
  '4k': { day: '/experience/earth/day-4k.jpg', night: '/experience/earth/night-4k.jpg' },
  '2k': { day: '/experience/earth/day-2k.jpg', night: '/experience/earth/night-2k.jpg' },
  clouds: '/experience/earth/clouds-2k.jpg',
  water: '/experience/earth/water-2k.jpg',
  bump: '/experience/earth/bump-2k.jpg',
} as const;

/** Imagery credit — the textures are NASA public-domain composites, not live satellite data. */
export const EARTH_IMAGERY_CREDIT =
  'Imagery: NASA Blue Marble & Black Marble (public domain) via three-globe. Composite, not live satellite data. Day/night line computed for the current time.';
