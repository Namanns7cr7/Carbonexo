'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Reveal } from './Reveal';
import { GlassCard } from './ui/GlassCard';

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
        <GlassCard className="mx-auto max-w-[640px] !rounded-[26px] border border-emerald-500/20 bg-slate-900/60 backdrop-blur-md p-[clamp(20px,4vw,34px)] shadow-lg shadow-emerald-500/5">
          <div className="mb-[22px] flex items-center gap-2.5 border-b border-emerald-500/20 pb-[18px]">
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-gradient-to-br from-emerald-500 to-teal-400 text-slate-950 font-bold text-[17px] shadow-sm">✦</div>
            <div>
              <div className="text-[15px] font-bold text-white">Carbonexo Coach</div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Online now · Gemini 2.0 Flash
              </div>
            </div>
          </div>

          <div className="mb-4 flex justify-end">
            <div className="max-w-[78%] rounded-[18px_18px_5px_18px] bg-gradient-to-r from-emerald-600 to-emerald-500 px-[17px] py-[13px] text-[14.5px] font-semibold leading-[1.5] text-white shadow-md shadow-emerald-600/20">
              How can I reduce my footprint this week?
            </div>
          </div>

          {state === 'typing' && (
            <div className="flex justify-start">
              <div className="w-full max-w-[82%] rounded-[18px_18px_18px_5px] border border-emerald-500/30 bg-slate-900/90 p-3.5 shadow-md">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span>Synthesizing footprint analysis...</span>
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-4/5 rounded bg-gradient-to-r from-emerald-500/10 via-emerald-500/25 to-emerald-500/10 animate-pulse" />
                  <div className="h-3 w-full rounded bg-gradient-to-r from-emerald-500/15 via-emerald-500/30 to-emerald-500/15 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {state === 'done' && (
            <div className="flex justify-start gap-2.5">
              <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[13px]">✦</div>
              <div className="max-w-[80%] rounded-[18px_18px_18px_5px] border border-emerald-500/20 bg-slate-800/80 backdrop-blur-sm px-[17px] py-3.5 text-[14.5px] leading-[1.55] text-slate-100 shadow-sm">
                Your <strong className="text-white">travel footprint</strong> is your largest source this week. Try replacing two car/bike
                trips with public transport — you could save around <strong className="text-emerald-400">8 kg CO₂</strong> and
                lift your weekly score by <strong className="text-emerald-400">14%</strong>.
              </div>
            </div>
          )}

          <div className="mt-[22px] flex flex-wrap gap-2">
            {SUGGESTIONS.map((q) => (
              <Link key={q} href="/app/coach" className="rounded-full border border-emerald-500/25 bg-slate-900/60 backdrop-blur-sm px-3.5 py-[9px] text-[13px] font-semibold text-slate-300 transition-colors hover:border-emerald-500 hover:text-emerald-300 hover:bg-emerald-500/10">{q}</Link>
            ))}
          </div>
        </GlassCard>
      </Reveal>
    </section>
  );
}
