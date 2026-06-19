'use client';

import { Reveal } from './Reveal';

const STEPS = [
  { icon: '📝', title: 'Log activity', desc: 'Travel, meals, energy in seconds', soft: 'var(--lime-soft)' },
  { icon: '🧮', title: 'Calculate footprint', desc: 'Instant CO₂ estimate', soft: 'var(--blue-soft)' },
  { icon: '💡', title: 'Get insights', desc: 'See what drives emissions', soft: 'var(--lime-soft)' },
  { icon: '✅', title: 'Take action', desc: 'Follow simple swaps', soft: 'var(--blue-soft)' },
  { icon: '🌱', title: 'Reduce impact', desc: 'Watch your score improve', ink: true },
];

export function JourneyFlow() {
  return (
    <section id="journey" className="mx-auto max-w-[1100px] px-6 py-[72px]">
      <Reveal className="mb-12 text-center">
        <div className="mb-2.5 font-mono text-xs uppercase tracking-[0.16em] text-lime">How it works</div>
        <h2 className="font-display text-[clamp(30px,4vw,44px)] font-extrabold leading-[1.05] tracking-[-0.03em]">
          From daily habit to real impact
        </h2>
      </Reveal>
      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 90}>
            <div
              className="rounded-[20px] border p-[22px_18px] text-center"
              style={{
                background: s.ink ? 'var(--ink)' : 'var(--surface)',
                borderColor: s.ink ? 'var(--ink-border)' : 'var(--border)',
                boxShadow: s.ink ? '0 14px 40px -22px var(--shadow-strong),0 0 40px var(--glow)' : '0 14px 36px -26px var(--shadow)',
              }}
            >
              <div
                className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-[14px] text-[22px]"
                style={{ background: s.ink ? 'var(--lime)' : s.soft }}
              >
                {s.icon}
              </div>
              <div className="mb-[5px] text-[15px] font-bold" style={{ color: s.ink ? 'var(--ink-text)' : 'var(--text)' }}>{s.title}</div>
              <div className="text-[12.5px] leading-[1.4]" style={{ color: s.ink ? 'var(--ink-muted)' : 'var(--muted)' }}>{s.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
