'use client';

import { Reveal } from './Reveal';
import { useCountUp } from '@/lib/useCountUp';

function StatCard({ to, decimals, suffix, label, accent }: { to: number; decimals?: number; suffix?: string; label: string; accent?: boolean }) {
  const { ref, display } = useCountUp(to, { decimals, suffix });
  return (
    <div className="rounded-[18px] border border-ink-border p-5 backdrop-blur-md" style={{ background: 'rgba(255,255,255,0.07)' }}>
      <div className="font-display text-[34px] font-extrabold" style={{ color: accent ? 'var(--lime)' : 'var(--ink-text)' }}>
        <span ref={ref}>{display}</span>
      </div>
      <div className="mt-1 text-[13px] font-semibold text-ink-muted">{label}</div>
    </div>
  );
}

export function ProgressSection() {
  return (
    <section id="progress" className="mx-auto max-w-[1100px] px-6 py-[60px]">
      <div
        className="relative overflow-hidden rounded-[30px] border border-ink-border p-[clamp(28px,5vw,52px)]"
        style={{ background: 'var(--ink)', boxShadow: '0 30px 70px -34px var(--shadow-strong),0 0 70px var(--glow)' }}
      >
        <div className="pointer-events-none absolute -right-10 -top-[60px] h-[280px] w-[280px] rounded-full" style={{ background: 'radial-gradient(circle,var(--glow-a),transparent 65%)' }} />
        <div className="relative z-[1] grid items-center gap-10 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          <Reveal>
            <div className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-lime">Stay motivated</div>
            <h2 className="mb-4 font-display text-[clamp(28px,3.6vw,40px)] font-extrabold leading-[1.06] tracking-[-0.03em] text-ink-text">
              Build a streak you&apos;ll be proud of
            </h2>
            <p className="mb-6 text-base leading-[1.6] text-ink-muted">
              Carbonexo turns reducing emissions into a daily habit — with streaks, milestones, and badges
              that keep small wins feeling big.
            </p>
            <div className="mb-2 text-[13px] font-semibold text-ink-muted">This week&apos;s streak</div>
            <div className="flex gap-[9px]">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="flex h-[42px] w-[42px] items-center justify-center rounded-xl text-lg"
                  style={{ background: i < 5 ? 'var(--lime)' : 'var(--ink-border)' }}
                >
                  {i < 5 ? '🔥' : ''}
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="grid grid-cols-2 gap-3.5">
              <StatCard to={5} suffix=" days" label="Weekly streak" />
              <StatCard to={42} suffix=" kg" label="CO₂ saved this month" accent />
              <StatCard to={18} label="Completed actions" />
              <div className="flex flex-col justify-center rounded-[18px] border border-lime p-5" style={{ background: 'rgba(163,230,53,0.16)' }}>
                <div className="mb-1.5 text-[26px]">🏆</div>
                <div className="text-sm font-bold text-ink-text">Low Carbon Week</div>
                <div className="mt-0.5 text-xs font-bold text-lime">Badge unlocked</div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
