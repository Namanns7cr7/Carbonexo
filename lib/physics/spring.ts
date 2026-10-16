/**
 * Damped-spring and inertia primitives.
 *
 * Everything that moves in Carbonexo's living-planet layer — the globe camera,
 * zoom, scroll-follow — is integrated with these instead of time-based easing,
 * so motion always continues from its current velocity: a new target never
 * causes a snap, and an interrupted move bends rather than restarts.
 *
 * Pure functions on plain numbers. No React, no three.js, no DOM.
 */

export interface SpringConfig {
  /** Restoring force per unit displacement (k). Higher = faster. */
  stiffness: number;
  /** Velocity damping (c). Use `dampingFor()` to pick by ratio instead. */
  damping: number;
  mass?: number;
}

/** A 1-D spring's state: position and velocity. Mutated in place by stepSpring. */
export interface SpringState {
  x: number;
  v: number;
}

/**
 * Damping coefficient for a target damping ratio ζ.
 * ζ = 1 is critically damped (fastest settle, no overshoot); ζ < 1 overshoots.
 */
export function dampingFor(stiffness: number, ratio: number, mass = 1): number {
  return 2 * ratio * Math.sqrt(stiffness * mass);
}

export function spring(stiffness: number, ratio: number, mass = 1): SpringConfig {
  return { stiffness, damping: dampingFor(stiffness, ratio, mass), mass };
}

/** Largest integration step. Frames longer than this are sub-stepped so a stiff spring can't explode after a tab stall. */
const MAX_STEP = 1 / 120;
/** Frames longer than this (tab was hidden, debugger paused) are clamped rather than simulated. */
const MAX_FRAME = 0.1;

/**
 * Advance a spring toward `target` by `dt` seconds (semi-implicit Euler,
 * sub-stepped). Mutates and returns `s`.
 */
export function stepSpring(s: SpringState, target: number, cfg: SpringConfig, dt: number): SpringState {
  const m = cfg.mass ?? 1;
  let remaining = Math.min(Math.max(dt, 0), MAX_FRAME);
  while (remaining > 1e-9) {
    const h = Math.min(remaining, MAX_STEP);
    const a = (-cfg.stiffness * (s.x - target) - cfg.damping * s.v) / m;
    s.v += a * h;
    s.x += s.v * h;
    remaining -= h;
  }
  return s;
}

/** Exponential velocity decay — friction for inertial glides. Frame-rate independent. */
export function decay(v: number, friction: number, dt: number): number {
  return v * Math.exp(-friction * Math.min(Math.max(dt, 0), MAX_FRAME));
}

/** Frame-rate–independent approach of `current` toward `target` (first-order lag). */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * Math.min(Math.max(dt, 0), MAX_FRAME));
}

/** Whether a spring has come to rest at `target`. */
export function isSettled(s: SpringState, target: number, eps = 1e-3): boolean {
  return Math.abs(s.x - target) < eps && Math.abs(s.v) < eps;
}

// ─── Angles ──────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;

/** Wrap an angle in radians to (−π, π]. */
export function wrapAngle(a: number): number {
  let r = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  if (r === -Math.PI) r = Math.PI;
  return r;
}

/**
 * The equivalent of `target` nearest to `current`, so a spring on an angle
 * takes the short way round (170° → −170° is a 20° move, not 340°).
 */
export function nearestAngle(current: number, target: number): number {
  return current + wrapAngle(target - current);
}

// ─── Soft limits ─────────────────────────────────────────────────────────────

/**
 * Rubber-band a value past [min, max]: free inside the range, increasingly
 * resistant outside it (the iOS overscroll curve). `give` is how far it can be
 * pulled past the edge, asymptotically.
 */
export function rubberBand(x: number, min: number, max: number, give: number): number {
  if (x < min) return min - give * (1 - 1 / ((min - x) / give + 1));
  if (x > max) return max + give * (1 - 1 / ((x - max) / give + 1));
  return x;
}

export function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x;
}

// ─── Tuned presets ───────────────────────────────────────────────────────────

/**
 * Named springs, so every surface that moves "like the planet" moves the same
 * way. Ratios just under 1 give one barely-visible overshoot — enough to read
 * as mass, never enough to wobble.
 */
export const SPRINGS = {
  /** Camera following a story target or flying to a region. */
  camera: spring(9, 0.92),
  /** Zoom distance. Slightly firmer than rotation — zoom lag feels like latency. */
  zoom: spring(14, 0.95),
  /** Settling back inside a soft limit after a drag past it. */
  limit: spring(40, 1),
} as const;
