'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCarbon } from '@/lib/store';
import { round1 } from '@/lib/carbon';
import { Card, PageHead } from '@/components/app/ui';
import { usePwaInstall } from '@/lib/usePwaInstall';

export default function Profile() {
  const router = useRouter();
  const { profile, totalSaved, streak, completedCount, weekTotals, resetAll } = useCarbon();
  const { promptInstall, installed } = usePwaInstall();
  const weekTotal = round1(weekTotals.reduce((s, d) => s + d.total, 0));
  const activeDays = weekTotals.filter((d) => d.total > 0).length;
  const avg = activeDays ? round1(weekTotal / activeDays) : 0;

  const badges = [
    { emoji: '🌱', title: 'First steps', desc: 'Completed setup', earned: true },
    { emoji: '🔥', title: `${streak}-day streak`, desc: 'Tracked consistently', earned: streak >= 3 },
    { emoji: '🏆', title: 'Low Carbon Week', desc: 'Avg under 8 kg/day', earned: avg > 0 && avg < 8 },
    { emoji: '✅', title: 'Action taker', desc: 'Completed actions', earned: completedCount > 0 },
    { emoji: '💚', title: 'Climate hero', desc: 'Saved 50+ kg CO₂', earned: totalSaved >= 50 },
    { emoji: '⭐', title: 'Goal crusher', desc: `${profile.weeklyGoalPct}% weekly target`, earned: false },
  ];

  const details = [
    { label: 'Main travel', value: `${profile.travelMode} · ${profile.dailyDistance} km/day` },
    { label: 'Diet', value: profile.diet },
    { label: 'Electricity', value: profile.electricity },
    { label: 'Shopping', value: profile.shopping },
    { label: 'Weekly goal', value: `${profile.weeklyGoalPct}% reduction` },
  ];

  const onReset = () => {
    if (confirm('Reset all Carbonexo data and sample logs? This cannot be undone.')) {
      resetAll();
      router.replace('/onboarding');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="Profile" title="Your progress" />

      {/* identity */}
      <Card className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lime text-2xl font-extrabold text-[#0c1d15]">
          {profile.name.charAt(0).toUpperCase()}
        </span>
        <div className="flex-1">
          <div className="font-display text-xl font-extrabold">{profile.name}</div>
          <div className="text-sm text-muted">Carbon tracker since 2026</div>
        </div>
        <Link href="/onboarding" className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold transition-colors hover:border-lime">Edit</Link>
      </Card>

      {/* stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { v: `${totalSaved}`, u: 'kg CO₂ saved', accent: true },
          { v: `${streak}`, u: 'day streak' },
          { v: `${completedCount}`, u: 'actions done' },
          { v: `${weekTotal}`, u: 'kg this week' },
        ].map((s) => (
          <Card key={s.u} className="!p-4 text-center">
            <div className="font-display text-[clamp(22px,5vw,30px)] font-extrabold" style={{ color: s.accent ? 'var(--lime-deep)' : 'var(--text)' }}>{s.v}</div>
            <div className="mt-0.5 text-[11px] font-semibold text-muted">{s.u}</div>
          </Card>
        ))}
      </div>

      {/* badges */}
      <div>
        <h2 className="mb-3 text-[15px] font-bold">Badges</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {badges.map((b) => (
            <Card
              key={b.title}
              className="flex flex-col items-center gap-1 text-center !p-4"
              style={{ opacity: b.earned ? 1 : 0.45, borderColor: b.earned ? 'var(--lime)' : 'var(--border)' }}
            >
              <span className="text-3xl" style={{ filter: b.earned ? 'none' : 'grayscale(1)' }}>{b.emoji}</span>
              <span className="text-[13px] font-bold">{b.title}</span>
              <span className="text-[11px] text-muted">{b.earned ? b.desc : 'Locked'}</span>
            </Card>
          ))}
        </div>
      </div>

      {/* preferences */}
      <Card>
        <h2 className="mb-3 text-[15px] font-bold">Your habits</h2>
        <div className="flex flex-col divide-y divide-border">
          {details.map((d) => (
            <div key={d.label} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-muted">{d.label}</span>
              <span className="font-semibold">{d.value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* PWA install */}
      <Card className="flex flex-wrap items-center justify-between gap-3 !bg-lime-soft">
        <div>
          <div className="text-[15px] font-bold">📲 Install Carbonexo</div>
          <p className="text-sm text-muted">Add it to your home screen for one-tap daily tracking.</p>
        </div>
        <button
          onClick={promptInstall}
          className="rounded-xl bg-lime px-5 py-2.5 text-sm font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5"
        >
          {installed ? '✓ Installed' : 'Install app'}
        </button>
      </Card>

      {/* danger zone */}
      <button onClick={onReset} className="self-start text-sm font-semibold text-muted underline-offset-2 transition-colors hover:text-text hover:underline">
        Reset all data
      </button>
    </div>
  );
}
