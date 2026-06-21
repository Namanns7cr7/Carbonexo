import { api } from './client';

export interface ActivityLogResponse {
  id: string;
  category: string;
  factorKey: string;
  label: string;
  emoji: string;
  quantity: number | null;
  unit: string;
  co2Kg: number;
  note: string;
  activityDate: string;
  source: string;
}

export interface CreateActivityRequest {
  category: string;
  factorKey?: string;
  label: string;
  emoji?: string;
  quantity?: number;
  unit?: string;
  co2Kg: number;
  note?: string;
  activityDate: string;
}

export async function getActivities(from?: string, to?: string): Promise<ActivityLogResponse[]> {
  const params = from && to ? `?from=${from}&to=${to}` : '';
  return api.get<ActivityLogResponse[]>(`/api/activities${params}`);
}

export async function createActivity(data: CreateActivityRequest): Promise<ActivityLogResponse> {
  return api.post<ActivityLogResponse>('/api/activities', data);
}

export async function deleteActivity(id: string): Promise<void> {
  return api.delete(`/api/activities/${id}`);
}
