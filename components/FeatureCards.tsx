'use client';

import { Reveal } from './Reveal';

const FEATURES = [
  { icon: '📊', soft: 'var(--lime-soft)', accent: 'var(--lime)', title: 'Daily Tracking', desc: 'Log travel, meals, electricity, shopping, and green actions — all in a few taps.' },
  { icon: '💡', soft: 'var(--blue-soft)', accent: 'var(--blue)', title: 'Personalized Insights', desc: 'Understand what causes your highest emissions, explained in plain language.' },
  { icon: '🔄', soft: 'var(--lime-soft)', accent: 'var(--lime)', title: 'Carbon Swaps', desc: 'Get better alternatives — car to metro, delivery to home meal — with the savings shown.' },
  { icon: '✦', soft: 'var(--blue-soft)', accent: 'var(--blue)', title: 'AI Coach', desc: 'Ask how to reduce your footprint this week and get a personal, actionable plan.' },
];

export function FeatureCards() {
  return (
    <section id="features" className="mx-auto max-w-[1200px] px-6 py-[60px]">
      <Reveal className="mb-10 max-w-[560px]">
        <div className="mb-2.5 font-mono text-xs uppercase tracking-[0.16em] text-lime">Features</div>
        <h2 className="mb-3 font-display text-[clamp(30px,4vw,44px)] font-extrabold leading-[1.05] tracking-[-0.03em]">
          Everything to build a lighter daily routine
        </h2>
        <p className="text-[17px] leading-[1.55] text-muted">
          Not a calculator you open once. A companion you&apos;ll want to check every day.
        </p>
      </Reveal>
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 90}>
            <div
              className="group h-full rounded-[22px] border border-border bg-surface p-[26px] shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = f.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div className="mb-[18px] flex items-center justify-center rounded-[15px] text-2xl" style={{ background: f.soft, width: 52, height: 52 }}>
                {f.icon}
              </div>
              <h3 className="mb-2 font-display text-xl font-bold">{f.title}</h3>
              <p className="text-[14.5px] leading-[1.55] text-muted">{f.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
