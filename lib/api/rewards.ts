import { api } from './client';

export interface RewardData {
  id: string; rewardKey: string; title: string; description: string;
  costCredits: number; stock: number | null; partner: string; imageUrl: string;
}

export interface RedemptionData {
  id: string; rewardId: string; rewardTitle: string;
  costCredits: number; status: string; createdAt: string;
}

export async function getRewards(): Promise<RewardData[]> {
  return api.get<RewardData[]>('/api/rewards');
}

export async function redeemReward(rewardId: string): Promise<RedemptionData> {
  return api.post<RedemptionData>(`/api/rewards/${rewardId}/redeem`);
}

export async function getRedemptions(): Promise<RedemptionData[]> {
  return api.get<RedemptionData[]>('/api/rewards/redemptions');
}
