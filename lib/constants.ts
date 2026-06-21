/**
 * Application-wide constants.
 *
 * Keep magic strings and numeric thresholds here so that every module
 * references the same source of truth. Import only what you need to
 * avoid pulling unnecessary values into a bundle chunk.
 */

// ─── localStorage keys ───────────────────────────────────────────────────────

/** Persisted JWT refresh token. */
export const TOKEN_REFRESH_KEY = 'cx-refresh';

/** Persisted Zustand/context state snapshot. */
export const STATE_STORAGE_KEY = 'cx-state';

/** Persisted theme preference ('light' | 'dark'). */
export const THEME_STORAGE_KEY = 'cx-theme';

// ─── Local state version ─────────────────────────────────────────────────────

/**
 * Increment this whenever the shape of the persisted State changes in a
 * backwards-incompatible way. Old stored values will be discarded and the
 * seed will be used instead.
 */
export const STATE_VERSION = 1;

// ─── Carbon/domain constants ──────────────────────────────────────────────────

/**
 * A "heavy" day's CO₂ kg reference used to normalise the score ring
 * fraction. A day at or above this value fills the ring completely.
 */
export const HEAVY_DAY_KG = 12;

// ─── Brand colours ───────────────────────────────────────────────────────────

/**
 * Dark brand text colour used on lime/accent backgrounds.
 * Matches the Tailwind config value for `text-[#0c1d15]`.
 */
export const BRAND_DARK = '#0c1d15';
