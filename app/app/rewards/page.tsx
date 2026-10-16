'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getRewards, redeemReward, getRedemptions, type RewardData, type RedemptionData } from '@/lib/api/rewards';
import { getBalance } from '@/lib/api/credits';
import { PageHead, Card } from '@/components/app/ui';
import { useLivingWorld } from '@/lib/living-world/LivingWorldProvider';
import { Growth } from '@/components/living-world/Growth';
import { Celebrate, TactileCard } from '@/components/physics';

export default function RewardsPage() {
  const [rewards, setRewards] = useState<RewardData[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionData[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<'loading' | 'ok' | 'error'>('loading');
  const [redeemed, setRedeemed] = useState<{ id: string; n: number } | null>(null);
  const { refreshLedger } = useLivingWorld();

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
      setLoaded('ok');
    } catch (err) {
      console.error('Failed to load rewards data', err);
      setLoaded('error');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRedeem = async (reward: RewardData) => {
    if (balance !== null && balance < reward.costCredits) {
      setError(`You need ${reward.costCredits - balance} more Green Points for this reward.`);
      return;
    }
    setRedeemingId(reward.id);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await redeemReward(reward.id);
      setSuccessMsg(`Request recorded: ${reward.title}. It is pending — Carbonexo does not yet fulfil partner rewards automatically.`);
      setRedeemed((r) => ({ id: reward.id, n: (r?.n ?? 0) + 1 }));
      const updatedBalance = await getBalance();
      setBalance(updatedBalance.balance);
      refreshLedger();
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
          eyebrow="Rewards"
          title="Spend your Green Points"
          sub="Points come from real activity in Carbonexo: signing up, completing plan actions once each, and confirming bills."
        />
        {balance !== null && (
          <div className="flex-shrink-0 self-start md:self-center rounded-[20px] border border-lime/30 bg-lime-soft/40 px-5 py-3 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-lime-deep">Your balance</div>
            <div className="text-2xl font-black text-text">{balance.toLocaleString()} <span className="text-sm font-bold text-muted">Green Points</span></div>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-center text-xs font-semibold text-danger">
          {error}
        </div>
      )}

      {successMsg && (
        <div role="status" className="rounded-xl border border-lime/30 bg-lime-soft/30 px-4 py-3 text-center text-xs font-semibold text-lime-deep">
          {successMsg}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h2 className="mb-1 text-lg font-bold">Catalog</h2>
        <p className="mb-4 text-xs leading-relaxed text-muted">
          Green Points are in-app rewards, not carbon credits. Redeeming a reward does not retire an offset or plant a tree: the catalog is a demo set of partner offers, and requests are recorded as pending.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
          {loaded === 'loading' ? (
            [0, 1, 2].map((i) => <div key={i} className="h-[180px] animate-pulse rounded-[20px] border border-border bg-surface2" />)
          ) : loaded === 'error' ? (
            <div className="sm:col-span-2 md:col-span-3 py-8 text-center text-sm text-muted">
              Couldn&apos;t load rewards.{' '}
              <button onClick={fetchData} className="font-bold text-lime-deep underline">Try again</button>
            </div>
          ) : rewards.length === 0 ? (
            <div className="sm:col-span-2 md:col-span-3 py-8 text-center text-sm text-muted">
              No rewards available at the moment.
            </div>
          ) : (
            rewards.map((reward) => {
              const canAfford = balance !== null && balance >= reward.costCredits;
              const hasStock = reward.stock === null || reward.stock > 0;
              return (
                <TactileCard key={reward.id} className="relative flex flex-col justify-between rounded-[20px] border border-border p-5 transition-colors hover:border-lime/50" style={{ background: 'var(--card)' }}>
                  {redeemed?.id === reward.id && <Celebrate trigger={redeemed.n} label="Requested" />}
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-xs font-semibold text-muted">{reward.partner}</span>
                      <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-extrabold text-[#0c1d15]">
                        {reward.costCredits} pts
                      </span>
                    </div>
                    <h3 className="text-[15px] font-bold leading-snug">{reward.title}</h3>
                    <p className="mt-1 text-xs text-muted leading-relaxed">{reward.description}</p>
                    {balance !== null && (
                      <div className="mt-3 flex items-center gap-2">
                        <Growth size={34} progress={Math.min(1, balance / reward.costCredits)} label={`${Math.min(100, Math.round((balance / reward.costCredits) * 100))}% of the points needed`} />
                        <span className="text-[11px] font-semibold text-muted">
                          {canAfford ? 'You have enough points' : `${reward.costCredits - balance} points to go`}
                        </span>
                      </div>
                    )}
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
                      {redeemingId === reward.id ? 'Requesting…' : 'Redeem'}
                    </button>
                  </div>
                </TactileCard>
              );
            })
          )}
        </div>
      </motion.div>

      <Card className="mt-4">
        <h2 className="mb-4 text-lg font-bold">Redemption History</h2>
        <div className="flex flex-col gap-3">
          {redemptions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted">
              No redemptions yet.
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
                  <div className="font-extrabold text-lime-deep">−{red.costCredits} pts</div>
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
