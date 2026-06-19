'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Reveal } from './Reveal';

const SUGGESTIONS = ['Is my travel footprint high?', 'Easiest action today?', 'How much can metro save?'];

export function AICoachPreview() {
  const [state, setState] = useState<'idle' | 'typing' | 'done'>('idle');
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const start = () => {
      setState((s) => {
        if (s !== 'idle') return s;
        setTimeout(() => setState('done'), 1600);
        return 'typing';
      });
    };
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && start()), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="coach" ref={sectionRef} className="mx-auto max-w-[900px] px-6 py-[60px]">
      <Reveal className="mb-10 text-center">
        <div className="mb-2.5 font-mono text-xs uppercase tracking-[0.16em] text-lime">AI Coach</div>
        <h2 className="font-display text-[clamp(30px,4vw,44px)] font-extrabold leading-[1.05] tracking-[-0.03em]">
          Your personal coach, on demand
        </h2>
      </Reveal>
      <Reveal delay={80}>
        <div className="mx-auto max-w-[640px] rounded-[26px] border border-border bg-surface p-[clamp(20px,4vw,34px)] shadow-card">
          <div className="mb-[22px] flex items-center gap-2.5 border-b border-border pb-[18px]">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-lime text-[17px]">✦</div>
            <div>
              <div className="text-[15px] font-bold">Carbonexo Coach</div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-lime-deep">
                <span className="h-[7px] w-[7px] rounded-full bg-lime" />Online now
              </div>
            </div>
          </div>

          <div className="mb-4 flex justify-end">
            <div className="max-w-[78%] rounded-[18px_18px_5px_18px] bg-lime px-[17px] py-[13px] text-[14.5px] font-medium leading-[1.5] text-[#0c1d15]">
              How can I reduce my footprint this week?
            </div>
          </div>

          {state === 'typing' && (
            <div className="flex justify-start">
              <div className="flex gap-1.5 rounded-[18px_18px_18px_5px] border border-border bg-surface2 px-[18px] py-[15px]">
                {[0, 0.2, 0.4].map((d) => (
                  <span key={d} className="h-2 w-2 rounded-full bg-muted" style={{ animation: `blink 1.2s ${d}s infinite` }} />
                ))}
              </div>
            </div>
          )}

          {state === 'done' && (
            <div className="flex justify-start gap-2.5">
              <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[9px] bg-lime-soft text-[13px]">✦</div>
              <div className="max-w-[80%] rounded-[18px_18px_18px_5px] border border-border bg-surface2 px-[17px] py-3.5 text-[14.5px] leading-[1.55]">
                Your <strong>travel footprint</strong> is your largest source this week. Try replacing two car/bike
                trips with public transport — you could save around <strong className="text-lime-deep">8 kg CO₂</strong> and
                lift your weekly score by <strong className="text-lime-deep">14%</strong>.
              </div>
            </div>
          )}

          <div className="mt-[22px] flex flex-wrap gap-2">
            {SUGGESTIONS.map((q) => (
              <Link key={q} href="/app/coach" className="rounded-full border border-border px-3.5 py-[9px] text-[13px] font-semibold text-muted transition-colors hover:border-lime hover:text-lime-deep">{q}</Link>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
