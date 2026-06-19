'use client';

const CATS = [
  { label: 'Travel', val: '3.1', pct: 62, color: 'var(--lime)' },
  { label: 'Food', val: '1.9', pct: 40, color: 'var(--blue)' },
  { label: 'Electricity', val: '1.8', pct: 36, color: '#c4d98a' },
];
const CHIPS = ['🚗 Travel', '🍽️ Food', '⚡ Electricity', '🛍️ Shopping', '🗑️ Waste'];
const BARS = [55, 78, 42, 66, 92, 50, 36];

/** The floating phone-less dashboard card + two floating glass cards. */
export function DashboardPreview() {
  return (
    <div className="relative w-[330px] max-w-full [transform-style:preserve-3d]">
      {/* main card */}
      <div
        className="relative z-[2] w-full rounded-[26px] border border-ink-border p-6 [animation:floatA_6s_ease-in-out_infinite]"
        style={{ background: 'var(--ink)', boxShadow: '0 40px 80px -34px var(--shadow-strong),0 0 60px var(--glow)' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-ink-muted">Good morning, Yash</div>
            <div className="font-display text-[17px] font-bold text-ink-text">Today&apos;s footprint</div>
          </div>
          <div className="rounded-full bg-lime-soft px-[11px] py-1.5 text-xs font-bold text-lime">↓ 12%</div>
        </div>
        <div className="mb-5 flex items-center gap-[18px]">
          <div className="relative h-[118px] w-[118px] flex-shrink-0">
            <svg width="118" height="118" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--ink-border)" strokeWidth="12" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--lime)" strokeWidth="12" strokeLinecap="round" strokeDasharray="327" strokeDashoffset="105" transform="rotate(-90 60 60)" className="[animation:ringdraw_1.6s_ease-out]" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-[27px] font-extrabold leading-none text-ink-text">6.8</div>
              <div className="text-[11px] font-semibold text-ink-muted">kg CO₂</div>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-[9px]">
            {CATS.map((c) => (
              <div key={c.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-ink-text">{c.label}</span>
                  <span className="font-bold" style={{ color: c.color }}>{c.val}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-border">
                  <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <span key={c} className="rounded-full bg-ink-border px-2.5 py-[5px] text-[11px] font-semibold text-ink-text">{c}</span>
          ))}
        </div>
        <div className="flex h-[54px] items-end gap-1.5 rounded-[14px] bg-white/5 p-3">
          {BARS.map((h, i) => (
            <div key={i} className="flex-1 rounded" style={{ height: `${h}%`, background: h === 92 ? 'var(--lime)' : 'var(--ink-border)' }} />
          ))}
        </div>
      </div>

      {/* floating AI insight card */}
      <div
        className="absolute -left-9 -top-8 z-[3] w-[200px] rounded-[18px] border border-border p-3.5 backdrop-blur-xl [animation:floatB_7s_ease-in-out_infinite]"
        style={{ background: 'var(--card)', boxShadow: '0 20px 44px -22px var(--shadow-strong)' }}
      >
        <div className="mb-2 flex items-center gap-[7px]">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-lime text-xs">✦</div>
          <span className="text-xs font-bold">AI Insight</span>
        </div>
        <p className="text-xs leading-[1.45] text-muted">
          Travel is your biggest source this week. Two metro trips could save <strong className="text-text">~8 kg CO₂</strong>.
        </p>
      </div>

      {/* floating carbon swap card */}
      <div
        className="absolute -bottom-8 -right-9 z-[3] w-[210px] rounded-[18px] border border-border p-3.5 backdrop-blur-xl [animation:floatC_8s_ease-in-out_infinite]"
        style={{ background: 'var(--card)', boxShadow: '0 20px 44px -22px var(--shadow-strong)' }}
      >
        <div className="mb-2.5 flex items-center gap-1.5">
          <span className="text-xs font-bold">Carbon Swap</span>
          <span className="rounded-full bg-lime-soft px-[7px] py-0.5 text-[10px] font-bold text-lime-deep">−4.2 kg</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-[11px] bg-surface2 px-1 py-[9px] text-center">
            <div className="text-lg">🚗</div>
            <div className="mt-0.5 text-[10px] font-semibold text-muted">Car ride</div>
          </div>
          <div className="text-sm font-extrabold text-lime">→</div>
          <div className="flex-1 rounded-[11px] border border-lime bg-lime-soft px-1 py-[9px] text-center">
            <div className="text-lg">🚇</div>
            <div className="mt-0.5 text-[10px] font-bold text-lime-deep">Metro</div>
          </div>
        </div>
      </div>
    </div>
  );
}
