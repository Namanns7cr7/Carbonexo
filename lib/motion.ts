/**
 * Carbonexo motion tokens — the single source of timing for the living-world
 * experience.
 *
 * Phase 1 foundation. Every scene, chapter and interactive object consumes
 * these instead of inlining its own transition object, so the whole app shares
 * one sense of weight. The CSS mirror of this file lives in app/globals.css
 * (--dur-* and --ease-*); keep the two in sync.
 *
 * Deliberately framework-agnostic: plain data, no imports. That keeps it unit
 * testable under the `node` vitest environment and importable from server
 * components. The React wrapper is lib/useMotionTier.ts.
 */

// ─── Durations (seconds — Framer Motion's unit) ────────────────────────────────

export const DURATION = {
  xs: 0.12,
  sm: 0.22,
  md: 0.38,
  lg: 0.62,
  xl: 0.98,
  scene: 1.6,
} as const;

// ─── Easings (cubic-bezier control points) ────────────────────────────────────

export const EASE = {
  out: [0.2, 0.7, 0.2, 1],
  in: [0.5, 0, 0.75, 0],
  inOut: [0.6, 0, 0.3, 1],
  /** Long cinematic settle — chapter entrances, camera arrivals. */
  entrance: [0.16, 1, 0.3, 1],
} as const;

// ─── Spring presets ───────────────────────────────────────────────────────────

/**
 * Named by the job, not the numbers, so call sites read as intent.
 * `world` is intentionally heavy: a planet should feel like it has mass.
 */
export const SPRING = {
  gentle: { type: 'spring', stiffness: 120, damping: 20, mass: 1 },
  snappy: { type: 'spring', stiffness: 380, damping: 30, mass: 0.8 },
  /** Settle after a drag release. */
  drag: { type: 'spring', stiffness: 260, damping: 24, mass: 1 },
  /** Button/cursor attraction — light and quick to return. */
  magnetic: { type: 'spring', stiffness: 220, damping: 18, mass: 0.6 },
  /** Rotating the EcoWorld or the planet. */
  world: { type: 'spring', stiffness: 60, damping: 18, mass: 1.6 },
} as const;

export const STAGGER = { tight: 0.04, normal: 0.07, loose: 0.12 } as const;

// ─── Capability tiers ─────────────────────────────────────────────────────────

/**
 * - `full`  — WebGL scenes, particles, parallax, the whole directed experience.
 * - `lite`  — capable browser on a weak device: CSS/SVG equivalents, no WebGL,
 *             motion still allowed but cheap.
 * - `still` — the viewer asked for reduced motion, or WebGL is unavailable.
 *             Static composition, no decorative movement, information intact.
 *
 * Every chapter must be comprehensible at `still`. That is a correctness
 * requirement, not a downgrade path.
 */
export type MotionTier = 'full' | 'lite' | 'still';

export interface TierInput {
  /** `prefers-reduced-motion: reduce`. Null when not yet measured. */
  prefersReducedMotion?: boolean | null;
  /** navigator.deviceMemory (GB). Undefined on Safari/Firefox. */
  deviceMemory?: number;
  /** navigator.hardwareConcurrency. */
  cores?: number;
  /** True when WebGL context creation failed or is unsupported. */
  webglUnavailable?: boolean;
  /** Coarse pointer — touch device. Not disqualifying on its own. */
  coarsePointer?: boolean;
}

/**
 * Pure tier resolution. Order matters: a stated preference and a hard
 * capability failure both win over any device heuristic.
 *
 * Unknown capability is treated as capable — absent `deviceMemory` on Safari
 * and Firefox must not demote every desktop user to `lite`.
 */
export function resolveMotionTier(input: TierInput = {}): MotionTier {
  const { prefersReducedMotion, deviceMemory, cores, webglUnavailable, coarsePointer } = input;

  if (prefersReducedMotion) return 'still';
  if (webglUnavailable) return 'still';

  if (typeof deviceMemory === 'number' && deviceMemory <= 4) return 'lite';
  if (typeof cores === 'number' && cores <= 4) return 'lite';
  // A touch device with no capability signal at all: assume mid-range phone.
  if (coarsePointer && deviceMemory === undefined && cores === undefined) return 'lite';

  return 'full';
}

/** Whether a tier may mount a WebGL scene at all. */
export function allowsWebGL(tier: MotionTier): boolean {
  return tier === 'full';
}

/** Whether a tier may run looping decorative motion (drift, particles, float). */
export function allowsAmbientMotion(tier: MotionTier): boolean {
  return tier !== 'still';
}

/**
 * Scale a duration for the tier. `still` collapses to effectively instant so a
 * transition cannot be perceived as movement, while keeping a non-zero value —
 * Framer Motion treats 0 as "no transition" and can skip completion callbacks.
 */
export function scaleDuration(seconds: number, tier: MotionTier): number {
  if (tier === 'still') return 0.001;
  if (tier === 'lite') return seconds * 0.75;
  return seconds;
}

// ─── Variant factories ───────────────────────────────────────────────────────

export interface FadeUpOptions {
  /** Seconds. */
  delay?: number;
  /** Travel distance in px. Zeroed at `still`. */
  distance?: number;
  duration?: number;
}

/**
 * The house entrance. Matches the existing <Reveal> feel at `full` so the
 * foundation does not visually contradict screens already shipped.
 */
export function fadeUp(tier: MotionTier, options: FadeUpOptions = {}) {
  const { delay = 0, distance = 30, duration = DURATION.lg } = options;
  const travel = tier === 'still' ? 0 : distance;

  return {
    initial: { opacity: 0, y: travel },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: scaleDuration(duration, tier),
      delay: tier === 'still' ? 0 : delay,
      ease: EASE.out,
    },
  };
}

/**
 * fadeUp for content below the fold: plays when the element scrolls into view.
 *
 * The starting offset is NOT tier-dependent, on purpose. useMotionTier starts
 * at `still` and upgrades after mount, but Framer Motion captures `initial`
 * only at mount — so a tier-gated offset would always be read as 0 and the
 * slide would never play for anyone. Reduced motion is honoured instead by the
 * transition: at `still` it completes in 1ms, which is a snap, not movement.
 */
export function revealInView(tier: MotionTier, options: FadeUpOptions & { amount?: number } = {}) {
  const { delay = 0, distance = 30, duration = DURATION.lg, amount = 0.25 } = options;

  return {
    initial: { opacity: 0, y: distance },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount },
    transition: {
      duration: scaleDuration(duration, tier),
      delay: tier === 'still' ? 0 : delay,
      ease: EASE.out,
    },
  };
}

/** Chapter-level arrival: slower, with depth, for full-viewport scenes. */
export function sceneEnter(tier: MotionTier, options: { delay?: number } = {}) {
  const { delay = 0 } = options;
  const moves = tier !== 'still';

  return {
    initial: { opacity: 0, y: moves ? 48 : 0, scale: moves ? 0.98 : 1 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: {
      duration: scaleDuration(DURATION.scene, tier),
      delay: tier === 'still' ? 0 : delay,
      ease: EASE.entrance,
    },
  };
}

/** Stagger container for a group of children revealing in sequence. */
export function stagger(tier: MotionTier, step: number = STAGGER.normal) {
  return {
    animate: {
      transition: {
        staggerChildren: tier === 'still' ? 0 : step,
        delayChildren: 0,
      },
    },
  };
}
