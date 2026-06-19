import { api } from './client';

export interface ProfileData {
  id: string; userId: string; name: string; travelMode: string;
  dailyDistanceKm: number; diet: string; electricityUsage: string;
  shoppingHabit: string; weeklyGoalPct: number; region: string; onboarded: boolean;
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
