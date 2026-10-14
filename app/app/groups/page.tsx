'use client';

/**
 * Groups page — household/friend groups: create one, join one by invite
 * code, and jump into any group you already belong to.
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { createGroup, joinGroup, getMyGroups, type GroupSummary } from '@/lib/api/groups';
import { PageHead, Card, EmptyState, Loading } from '@/components/app/ui';

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const refresh = () => getMyGroups().then(setGroups).catch((err) => console.error('[Groups] Failed to load groups:', err));

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createGroup(groupName.trim());
      setGroupName('');
      await refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the group');
    } finally {
      setCreating(false);
    }
  };

  const onJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      await joinGroup(inviteCode.trim().toUpperCase());
      setInviteCode('');
      await refresh();
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Invite code not found');
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="Social"
        title="Household & friend groups"
        sub="Team up, compare your weekly carbon savings, and chase a combined goal together."
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-5 md:col-span-2">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Card>
              <h2 className="mb-4 text-lg font-bold">My groups</h2>
              {groups.length === 0 ? (
                <EmptyState
                  emoji="👥"
                  title="No groups yet"
                  sub="Create a group or join one with an invite code to start comparing progress."
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {groups.map((g) => (
                    <Link
                      key={g.id}
                      href={`/app/groups/${g.id}`}
                      className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface2 px-4 py-3.5 transition-colors hover:border-lime"
                    >
                      <div>
                        <div className="text-sm font-bold text-text">{g.name}</div>
                        <div className="mt-1 text-xs text-muted">
                          {g.memberCount} member{g.memberCount === 1 ? '' : 's'} · code{' '}
                          <span className="font-mono">{g.inviteCode}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-lime-deep">View →</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <h3 className="mb-3 text-sm font-bold">Create a group</h3>
            <form onSubmit={onCreate} className="flex flex-col gap-2">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. The Smiths"
                maxLength={120}
                className="rounded-xl border border-border bg-surface2 px-3 py-2 text-sm outline-none focus:border-lime"
              />
              {createError && <p className="text-xs text-danger">{createError}</p>}
              <button
                type="submit"
                disabled={creating || !groupName.trim()}
                className="rounded-xl bg-lime px-3 py-2 text-sm font-bold text-[#0c1d15] transition-transform hover:scale-[1.02] disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create group'}
              </button>
            </form>
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-bold">Join with a code</h3>
            <form onSubmit={onJoin} className="flex flex-col gap-2">
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="INVITE CODE"
                maxLength={16}
                className="rounded-xl border border-border bg-surface2 px-3 py-2 text-sm font-mono uppercase outline-none focus:border-lime"
              />
              {joinError && <p className="text-xs text-danger">{joinError}</p>}
              <button
                type="submit"
                disabled={joining || !inviteCode.trim()}
                className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-text transition-colors hover:border-lime disabled:opacity-50"
              >
                {joining ? 'Joining…' : 'Join group'}
              </button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
