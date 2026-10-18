import { api } from './client';

export interface ProfileData {
  id: string;
  userId: string;
  name: string;
  travelMode: string;
  dailyDistanceKm: number;
  diet: string;
  electricityUsage: string;
  shoppingHabit: string;
  weeklyGoalPct: number;
  region: string;
  onboarded: boolean;
}

export async function getProfile(): Promise<ProfileData> {
  return api.get<ProfileData>('/api/profiles/me');
}

export async function updateProfile(data: Partial<ProfileData>): Promise<ProfileData> {
  return api.put<ProfileData>('/api/profiles/me', data);
}

export async function completeOnboarding(): Promise<ProfileData> {
  return api.post<ProfileData>('/api/profiles/me/onboarding');
}

export interface RegionStatus {
  region: string;
  confirmed: boolean;
  /** legacy_default | suggested | user_confirmed | user_changed */
  source: string;
  /** Regions the factor registry has factors for. */
  supported: string[];
}

export async function getRegion(): Promise<RegionStatus> {
  return api.get<RegionStatus>('/api/profiles/me/region');
}

/** The user's explicit choice of region for emission estimates; validated server-side. */
export async function confirmRegion(region: string): Promise<RegionStatus> {
  return api.post<RegionStatus>('/api/profiles/me/region', { region });
}
