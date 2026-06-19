'use client';

import { Reveal } from './Reveal';

const SWAPS = [
  { label: 'Daily commute', badge: 'Save 4.2 kg', strong: true, from: { e: '🚗', t: 'Car ride' }, to: { e: '🚇', t: 'Metro' } },
  { label: 'Lunch order', badge: 'Save 1.5 kg', strong: true, from: { e: '🛵', t: 'Delivery' }, to: { e: '🍳', t: 'Home meal' } },
  { label: 'Hydration', badge: 'Less waste', strong: false, from: { e: '🥤', t: 'Plastic bottle' }, to: { e: '♻️', t: 'Reusable' } },
  { label: 'Cooling', badge: 'Save 0.8 kg', strong: true, from: { e: '❄️', t: 'AC all night' }, to: { e: '🌙', t: '30 min less' } },
];

export function CarbonSwapSection() {
  return (
    <section id="swap" className="mx-auto max-w-[1100px] px-6 py-[60px]">
      <Reveal className="mx-auto mb-[42px] max-w-[600px] text-center">
        <div className="mb-2.5 font-mono text-xs uppercase tracking-[0.16em] text-lime">Carbon Swap</div>
        <h2 className="mb-3 font-display text-[clamp(30px,4vw,44px)] font-extrabold leading-[1.05] tracking-[-0.03em]">
          Small swaps. Surprising savings.
        </h2>
        <p className="text-[17px] leading-[1.55] text-muted">Each swap shows the greener alternative and what you&apos;d save.</p>
      </Reveal>
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {SWAPS.map((s, i) => (
          <Reveal key={s.label} delay={i * 90}>
            <div
              className="overflow-hidden rounded-[22px] border border-border bg-surface p-[22px] shadow-soft transition-colors hover:border-lime"
            >
              <div className="mb-[18px] flex items-center justify-between">
                <span className="text-[15px] font-bold">{s.label}</span>
                <span
                  className="whitespace-nowrap rounded-full px-[11px] py-[5px] text-xs font-extrabold"
                  style={s.strong ? { background: 'var(--lime)', color: '#0c1d15' } : { background: 'var(--lime-soft)', color: 'var(--lime-deep)' }}
                >
                  {s.badge}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-[14px] border border-border bg-surface2 px-2 py-4 text-center">
                  <div className="text-3xl">{s.from.e}</div>
                  <div className="mt-1.5 text-[13px] font-semibold text-muted">{s.from.t}</div>
                </div>
                <div className="text-lg font-extrabold text-lime">→</div>
                <div className="flex-1 rounded-[14px] border border-lime bg-lime-soft px-2 py-4 text-center">
                  <div className="text-3xl">{s.to.e}</div>
                  <div className="mt-1.5 text-[13px] font-bold text-lime-deep">{s.to.t}</div>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
