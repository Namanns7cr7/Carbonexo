'use client';

import { useState, useEffect } from 'react';
import { getRewards, redeemReward, getRedemptions, type RewardData, type RedemptionData } from '@/lib/api/rewards';
import { getBalance } from '@/lib/api/credits';
import { PageHead, Card } from '@/components/app/ui';

export default function RewardsPage() {
  const [rewards, setRewards] = useState<RewardData[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionData[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [rewardsData, redemptionsData, balanceData] = await Promise.all([
        getRewards(),
        getRedemptions(),
        getBalance(),
      ]);
      setRewards(rewardsData);
      setRedemptions(redemptionsData);
      setBalance(balanceData.balance);
    } catch (err) {
      console.error('Failed to load rewards data', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRedeem = async (reward: RewardData) => {
    if (balance !== null && balance < reward.costCredits) {
      setError('Insufficient credits for this reward.');
      return;
    }
    setRedeemingId(reward.id);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await redeemReward(reward.id);
      setSuccessMsg(`Successfully redeemed: ${reward.title}!`);
      const updatedBalance = await getBalance();
      setBalance(updatedBalance.balance);
      setRedemptions((prev) => [result, ...prev]);
      setRewards((prev) =>
        prev.map((r) =>
          r.id === reward.id && r.stock !== null ? { ...r, stock: r.stock - 1 } : r
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to redeem reward');
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHead
          eyebrow="Green Rewards Store"
          title="Redeem Your Green Credits"
          sub="Trade the credits you earned for real-world eco-friendly products, offsets, and experiences."
        />
        {balance !== null && (
          <div className="flex-shrink-0 self-start md:self-center rounded-[20px] border border-lime/30 bg-lime-soft/40 px-5 py-3 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-lime-deep">Your Balance</div>
            <div className="text-2xl font-black text-text">🪙 {balance} <span className="text-sm font-bold text-muted">credits</span></div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-blue-soft/20 border border-blue/30 px-4 py-3 text-xs font-semibold text-blue text-center">
          ⚠️ {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-lime-soft/30 border border-lime/30 px-4 py-3 text-xs font-semibold text-lime-deep text-center">
          🎉 {successMsg}
        </div>
      )}

      <div>
        <h2 className="mb-4 text-lg font-bold">Available Rewards</h2>
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
          {rewards.length === 0 ? (
            <div className="sm:col-span-2 md:col-span-3 py-8 text-center text-sm text-muted">
              No rewards available at the moment.
            </div>
          ) : (
            rewards.map((reward) => {
              const canAfford = balance !== null && balance >= reward.costCredits;
              const hasStock = reward.stock === null || reward.stock > 0;
              return (
                <Card key={reward.id} className="flex flex-col justify-between hover:border-lime/50 transition-colors">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs font-semibold text-muted">{reward.partner}</span>
                      <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-extrabold text-[#0c1d15]">
                        🪙 {reward.costCredits}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-bold leading-snug">{reward.title}</h3>
                    <p className="mt-1 text-xs text-muted leading-relaxed">{reward.description}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted">
                      {reward.stock !== null ? `${reward.stock} left` : 'Unlimited'}
                    </span>
                    <button
                      disabled={!canAfford || !hasStock || redeemingId !== null}
                      onClick={() => handleRedeem(reward)}
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        canAfford && hasStock
                          ? 'bg-lime text-[#0c1d15] hover:scale-105'
                          : 'bg-surface2 border border-border text-muted cursor-not-allowed'
                      }`}
                    >
                      {redeemingId === reward.id ? 'Redeeming...' : 'Redeem'}
                    </button>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <Card className="mt-4">
        <h2 className="mb-4 text-lg font-bold">Redemption History</h2>
        <div className="flex flex-col gap-3">
          {redemptions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">
              You haven&apos;t redeemed any rewards yet. Start making carbon-saving choices!
            </div>
          ) : (
            redemptions.map((red) => (
              <div
                key={red.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-4 py-3 text-xs"
              >
                <div>
                  <div className="font-bold text-text">{red.rewardTitle}</div>
                  <div className="text-muted mt-0.5">
                    Redeemed on {new Date(red.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold text-lime-deep">-🪙 {red.costCredits}</div>
                  <span className="rounded-full bg-lime-soft px-2 py-0.5 text-[9px] font-extrabold uppercase text-lime-deep">
                    {red.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
