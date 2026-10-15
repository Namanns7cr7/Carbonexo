/**
 * SAMPLE DATA for previews and unconnected demos only.
 *
 * Never import this from a production screen — production components take
 * props mapped from the user's real data. Everything here is fictional and
 * labelled so: vault fixtures use a "Sample Registry" and SAMPLE- identifiers
 * so they cannot be mistaken for real registry records.
 */

import type {
  ActionItem,
  CertifiedCredit,
  DailyFootprintData,
  GoalData,
  GreenPointsBalance,
  ImpactPassportData,
  ReductionItem,
  RetirementRecord,
  WeeklyPoint,
} from './types';

export const SAMPLE_DAILY: DailyFootprintData = {
  date: '2026-10-15',
  kg: 6.4,
  goalKg: 8,
  byCategory: [
    { id: 'travel', label: 'Travel', kg: 2.3 },
    { id: 'food', label: 'Food', kg: 1.6 },
    { id: 'electricity', label: 'Electricity', kg: 1.8 },
    { id: 'shopping', label: 'Shopping', kg: 0.5 },
    { id: 'waste', label: 'Waste', kg: 0.2 },
  ],
};

export const SAMPLE_WEEK: WeeklyPoint[] = [
  { date: '2026-10-09', kg: 9.1 },
  { date: '2026-10-10', kg: 8.4 },
  { date: '2026-10-11', kg: 10.2 },
  { date: '2026-10-12', kg: 7.6 },
  { date: '2026-10-13', kg: 7.9 },
  { date: '2026-10-14', kg: 6.8 },
  { date: '2026-10-15', kg: 6.4 },
];

export const SAMPLE_REDUCTIONS: ReductionItem[] = [
  { id: 'metro', label: 'Metro twice a week', kgPerWeek: 8.0, basis: 'estimate' },
  { id: 'meatless', label: 'Two meat-free days', kgPerWeek: 6.4, basis: 'estimate' },
  { id: 'ac', label: 'AC off 30 min earlier', kgPerWeek: 2.1, basis: 'measured' },
];

export const SAMPLE_GOAL: GoalData = {
  id: 'weekly-budget',
  label: 'Weekly footprint budget',
  period: 'week',
  budgetKg: 60,
  usedKg: 33.8,
  elapsed: 4 / 7,
};

export const SAMPLE_ACTIONS: ActionItem[] = [
  { id: 'a1', title: 'Take the metro twice a week', done: true, completedAt: '2026-10-13T09:10:00Z', kgPerWeek: 8.0, basis: 'estimate' },
  { id: 'a2', title: 'Two meat-free days', done: true, completedAt: '2026-10-14T13:00:00Z', kgPerWeek: 6.4, basis: 'estimate' },
  { id: 'a3', title: 'Switch to LED bulbs', done: false, kgPerWeek: 1.6, basis: 'estimate' },
  { id: 'a4', title: 'Carry a reusable bottle', done: false, kgPerWeek: 0.8, basis: 'estimate' },
];

export const SAMPLE_PASSPORT: ImpactPassportData = {
  holder: 'Sample Traveller',
  memberSince: '2026-08-02',
  daysTracked: 41,
  actionsCompleted: 12,
  kgAvoidedEstimate: 86.5,
  stamps: [
    { id: 'first-log', label: 'First log', mark: '✦', earnedAt: '2026-08-02' },
    { id: 'week-streak', label: '7-day streak', mark: '◆', earnedAt: '2026-08-09' },
    { id: 'transit', label: 'Transit week', mark: '◐', earnedAt: '2026-09-18' },
    { id: 'plant', label: 'Plant-forward', mark: '❀', earnedAt: '2026-10-01' },
    { id: 'month', label: '30 days tracked', mark: '◎' },
    { id: 'hundred', label: '100 kg avoided', mark: '▲' },
  ],
};

export const SAMPLE_CREDITS: CertifiedCredit[] = [
  {
    id: 'c1',
    registry: 'Sample Registry',
    projectId: 'SAMPLE-1001',
    projectName: 'Sample Mangrove Restoration',
    country: 'Sample country',
    projectType: 'Blue carbon',
    methodology: 'SAMPLE-METHOD-01',
    vintage: 2024,
    serialRange: 'SAMPLE-1001-2024-000001 – 000005',
    tonnes: 5,
    status: 'held',
    registryUrl: 'https://example.org/registry/SAMPLE-1001',
  },
  {
    id: 'c2',
    registry: 'Sample Registry',
    projectId: 'SAMPLE-2002',
    projectName: 'Sample Clean Cookstoves',
    country: 'Sample country',
    projectType: 'Energy efficiency',
    vintage: 2023,
    serialRange: 'SAMPLE-2002-2023-000101 – 000102',
    tonnes: 2,
    status: 'retired',
    registryUrl: 'https://example.org/registry/SAMPLE-2002',
  },
];

export const SAMPLE_RETIREMENTS: RetirementRecord[] = [
  {
    id: 'r1',
    retiredAt: '2026-09-30',
    tonnes: 2,
    registry: 'Sample Registry',
    projectName: 'Sample Clean Cookstoves',
    serialRange: 'SAMPLE-2002-2023-000101 – 000102',
    beneficiary: 'Sample Traveller',
    reason: 'Sample retirement for preview',
    registryUrl: 'https://example.org/registry/SAMPLE-2002',
  },
];

export const SAMPLE_POINTS: GreenPointsBalance = { kind: 'green-points', balance: 1240, earnedThisMonth: 180 };
