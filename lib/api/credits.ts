import { api } from './client';

export interface CreditBalance { userId: string; balance: number; }
export interface CreditHistoryEntry {
  id: string; delta: number; balanceAfter: number; reason: string;
  ruleKey: string; refType: string; createdAt: string;
}

export async function getBalance(): Promise<CreditBalance> {
  return api.get<CreditBalance>('/api/credits/balance');
}

export async function getHistory(): Promise<CreditHistoryEntry[]> {
  return api.get<CreditHistoryEntry[]>('/api/credits/history');
}

export async function completeAction(actionKey: string): Promise<void> {
  return api.post(`/api/credits/action?actionKey=${encodeURIComponent(actionKey)}`);
}
