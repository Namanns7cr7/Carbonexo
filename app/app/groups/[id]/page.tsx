'use client';

/**
 * Group detail page — member list, a ranked leaderboard (toggle window /
 * metric), and what the group logged together this week.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  getGroupDetail,
  getLeaderboard,
  type Group,
  type LeaderboardEntry,
  type LeaderboardWindow,
  type LeaderboardMetric,
} from '@/lib/api/groups';
import { PageHead, Card, Loading, SegmentedControl } from '@/components/app/ui';
import { Growth } from '@/components/living-world/Growth';
import { ProvenanceBadge } from '@/components/living-world/Provenance';

const WINDOWS: { id: LeaderboardWindow; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
];

// 'co2_saved' is the API's historical key; the value is logged CO2, ranked lowest first.
const METRICS: { id: LeaderboardMetric; label: string }[] = [
  { id: 'co2_saved', label: 'CO₂ logged' },
  { id: 'credits', label: 'Green Points' },
];

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [group, setGroup] = useState<Group | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardAiSummary, setLeaderboardAiSummary] = useState<string | null>(null);
  const [thisWeek, setThisWeek] = useState<LeaderboardEntry[] | null>(null);
  const [window_, setWindow] = useState<LeaderboardWindow>('week');
  const [metric, setMetric] = useState<LeaderboardMetric>('co2_saved');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    // "This week together" uses the week's logged-CO2 board — real logs only. The old
    // goal-progress endpoint measured against a fixed 8 kg/day baseline, so it is not shown.
    Promise.all([getGroupDetail(groupId), getLeaderboard(groupId, 'week', 'co2_saved').catch(() => null)])
      .then(([g, w]) => {
        setGroup(g);
        setThisWeek(w ? w.entries : null);
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

      {thisWeek && (() => {
        const logging = thisWeek.filter((e) => e.value > 0);
        const total = Math.round(logging.reduce((s, e) => s + e.value, 0) * 10) / 10;
        const share = group.members.length ? logging.length / group.members.length : 0;
        return (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 120, damping: 20 }}>
            <Card className="flex items-center gap-4">
              <Growth progress={share} label={`${logging.length} of ${group.members.length} members logged this week`} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">This week together</h2>
                  <ProvenanceBadge provenance="logged" />
                </div>
                <p className="text-sm text-muted">
                  <strong className="text-text">{logging.length}</strong> of {group.members.length} members logged this week
                  {logging.length > 0 && (
                    <>
                      {' '}· <strong className="text-text">{total} kg</strong> CO₂e logged together
                    </>
                  )}
                  .
                </p>
                <p className="mt-1 text-[11px] text-muted">Shared progress is about logging and acting together. Carbonexo doesn&apos;t estimate a group &ldquo;saving&rdquo; it can&apos;t measure.</p>
              </div>
            </Card>
          </motion.div>
        );
      })()}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-5 md:col-span-2">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Leaderboard</h2>
                <p className="text-[11px] text-muted">{metric === 'co2_saved' ? 'Lowest logged CO₂ ranks first; members with no logs rank last.' : 'Green Points earned in this window.'}</p>
              </div>
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
                      {metric === 'co2_saved' ? `${entry.value} kg` : `${entry.value} pts`}
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
