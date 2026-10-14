'use client';

/**
 * Group detail page — member list, a ranked leaderboard (toggle window /
 * metric), and the group's combined weekly goal progress.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  getGroupDetail,
  getLeaderboard,
  getGoalProgress,
  type Group,
  type LeaderboardEntry,
  type GoalProgress,
  type LeaderboardWindow,
  type LeaderboardMetric,
} from '@/lib/api/groups';
import { PageHead, Card, Loading, SegmentedControl } from '@/components/app/ui';

const WINDOWS: { id: LeaderboardWindow; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
];

const METRICS: { id: LeaderboardMetric; label: string }[] = [
  { id: 'co2_saved', label: 'CO₂ saved' },
  { id: 'credits', label: 'Credits' },
];

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [group, setGroup] = useState<Group | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardAiSummary, setLeaderboardAiSummary] = useState<string | null>(null);
  const [progress, setProgress] = useState<GoalProgress | null>(null);
  const [window_, setWindow] = useState<LeaderboardWindow>('week');
  const [metric, setMetric] = useState<LeaderboardMetric>('co2_saved');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    Promise.all([getGroupDetail(groupId), getGoalProgress(groupId)])
      .then(([g, p]) => {
        setGroup(g);
        setProgress(p);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load group'))
      .finally(() => setLoading(false));
  }, [groupId]);

  const refreshLeaderboard = useCallback(() => {
    if (!groupId) return;
    getLeaderboard(groupId, window_, metric)
      .then((res) => {
        setLeaderboard(res.entries);
        setLeaderboardAiSummary(res.aiSummary);
      })
      .catch((err) => console.error('[GroupDetail] Failed to load leaderboard:', err));
  }, [groupId, window_, metric]);

  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  if (loading) return <Loading />;

  if (error || !group) {
    return (
      <div className="flex flex-col gap-4">
        <PageHead eyebrow="Social" title="Group not found" />
        <Card>
          <p className="text-sm text-muted">{error || 'This group could not be loaded.'}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="Social"
        title={group.name}
        sub={`Invite code: ${group.inviteCode} · ${group.members.length} member${group.members.length === 1 ? '' : 's'}`}
      />

      {progress && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card>
            <h2 className="mb-3 text-lg font-bold">Combined weekly goal</h2>
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-muted">
                {progress.combinedCurrentKg} / {progress.combinedGoalKg} kg CO₂ saved
              </span>
              <span className="font-bold text-lime-deep">{progress.progressPct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-surface2">
              <div
                className="h-full rounded-full bg-lime transition-[width]"
                style={{ width: `${Math.min(100, progress.progressPct)}%` }}
              />
            </div>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-5 md:col-span-2">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Leaderboard</h2>
              <div className="flex gap-2">
                <SegmentedControl options={WINDOWS} value={window_} onChange={setWindow} />
                <SegmentedControl options={METRICS} value={metric} onChange={setMetric} />
              </div>
            </div>

            {leaderboardAiSummary && (
              <div className="mb-3 rounded-xl border border-border bg-lime-soft px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-lime-deep">AI summary</div>
                <p className="mt-1 text-sm">{leaderboardAiSummary}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {leaderboard.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">No activity in this window yet.</div>
              ) : (
                leaderboard.map((entry) => (
                  <div
                    key={entry.userId}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface2 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-xs font-extrabold text-muted">
                        #{entry.rank}
                      </span>
                      <span className="text-sm font-bold text-text">{entry.displayName}</span>
                    </div>
                    <span className="text-sm font-extrabold text-lime-deep">
                      {metric === 'co2_saved' ? `${entry.value} kg` : `🪙 ${entry.value}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <h3 className="mb-3 text-sm font-bold">Members</h3>
            <div className="flex flex-col divide-y divide-border">
              {group.members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-semibold text-text">{m.displayName}</span>
                  <span className="text-xs uppercase font-bold text-muted">{m.role}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
