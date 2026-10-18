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

/** Last server snapshot (profile + dashboard) — painted instantly on reload. Cleared with tokens. */
export const SNAPSHOT_STORAGE_KEY = 'cx-snapshot';
/** Cached coach conversation for instant paint; the server holds the durable copy. Cleared with tokens. */
export const COACH_CHAT_STORAGE_KEY = 'carbonexo_coach_chat_history';
/** Unsent EcoMind message and the open thread id. Cleared with tokens. */
export const ECOMIND_DRAFT_STORAGE_KEY = 'carbonexo_ecomind_draft_msg';
export const ECOMIND_THREAD_STORAGE_KEY = 'carbonexo_ecomind_active_thread';
/** Pre-API local state; still read as a fallback by score and reports. */
export const LEGACY_STATE_STORAGE_KEY = 'carbonexo:v1';

/**
 * Everything in this browser that belongs to the signed-in user. Sign-out
 * removes all of it so the next account on this browser starts clean; the
 * server keeps the durable copies (profile, logs, EcoMind conversations).
 * The theme and "My items" (cx-custom-items, browser-local by design) stay.
 */
export const USER_SCOPED_STORAGE_KEYS = [
  TOKEN_REFRESH_KEY,
  STATE_STORAGE_KEY,
  SNAPSHOT_STORAGE_KEY,
  COACH_CHAT_STORAGE_KEY,
  ECOMIND_DRAFT_STORAGE_KEY,
  ECOMIND_THREAD_STORAGE_KEY,
  LEGACY_STATE_STORAGE_KEY,
] as const;

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
