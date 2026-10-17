/**
 * Prop contracts for the impact visualizations and the Carbon Credit Vault.
 *
 * Components in components/visualizations/ take these as props and never
 * fetch or hardcode user metrics. The integrating screen maps its own data
 * (lib/store.tsx, lib/api/*) onto these shapes — see
 * docs/experience-integration.md for the mapping.
 *
 * All masses are kilograms of CO₂e unless a name says tonnes.
 */

// ─── Impact ──────────────────────────────────────────────────────────────────

export interface CategorySlice {
  id: string;
  label: string;
  kg: number;
  /** Any CSS colour; falls back to the component palette. */
  color?: string;
}

export interface DailyFootprintData {
  /** YYYY-MM-DD, local. */
  date: string;
  kg: number;
  /** Optional daily target; the ring fills against it. */
  goalKg?: number;
  byCategory?: CategorySlice[];
}

/** Whether a reduction is measured from logs or an estimate from a catalog. Shown to the user. */
export type Basis = 'measured' | 'estimate';

export interface ReductionItem {
  id: string;
  label: string;
  kgPerWeek: number;
  basis: Basis;
}

export interface WeeklyPoint {
  /** YYYY-MM-DD, local. */
  date: string;
  kg: number;
}

export interface GoalData {
  id: string;
  label: string;
  period: 'week' | 'month';
  /** Emissions budget for the period — staying under it meets the goal. */
  budgetKg: number;
  /** Emitted so far in the period. */
  usedKg: number;
  /** Fraction of the period elapsed, 0..1 — used to show "on pace". */
  elapsed: number;
}

export interface ActionItem {
  id: string;
  title: string;
  done: boolean;
  /** ISO timestamp, when done. */
  completedAt?: string;
  kgPerWeek?: number;
  basis?: Basis;
}

export interface PassportStamp {
  id: string;
  label: string;
  /** ISO date earned; undefined = not yet earned (rendered as an outline). */
  earnedAt?: string;
  /** A short glyph or emoji. */
  mark: string;
}

export interface ImpactPassportData {
  holder: string;
  /** ISO date. */
  memberSince: string;
  daysTracked: number;
  actionsCompleted: number;
  /** Estimated avoided emissions — always labelled as an estimate in the UI. */
  kgAvoidedEstimate: number;
  stamps: PassportStamp[];
}

// ─── Carbon Credit Vault ─────────────────────────────────────────────────────

/**
 * An independently certified carbon credit holding — issued by a registry,
 * one unit = one tonne CO₂e. Never derived from Carbonexo activity.
 */
export interface CertifiedCredit {
  id: string;
  registry: string;
  /** Registry's own project identifier. */
  projectId: string;
  projectName: string;
  country: string;
  projectType: string;
  methodology?: string;
  vintage: number;
  /** Registry serial number range, as issued. */
  serialRange: string;
  tonnes: number;
  status: 'held' | 'retired';
  /** Public registry page for verification. */
  registryUrl?: string;
}

export interface RetirementRecord {
  id: string;
  /** ISO date. */
  retiredAt: string;
  tonnes: number;
  registry: string;
  projectName: string;
  serialRange: string;
  beneficiary: string;
  reason?: string;
  registryUrl?: string;
}

/**
 * Carbonexo's internal reward points (backed by credit_ledger). Earned in the
 * app, spendable on in-app rewards. NOT carbon credits: no registry, no
 * tonnes, cannot offset anything. Kept as a separate type so the two can
 * never be summed by accident.
 */
export interface GreenPointsBalance {
  kind: 'green-points';
  balance: number;
  earnedThisMonth?: number;
}
