'use client';

import Link from 'next/link';
import { Reveal } from './Reveal';
import { Logo } from './Logo';
import { usePwaInstall } from '@/lib/usePwaInstall';

export function FinalCTA() {
  const { promptInstall, installed } = usePwaInstall();
  return (
    <section id="cta" className="mx-auto max-w-[1100px] px-6 pb-[90px] pt-[60px]">
      <Reveal>
        <div
          className="relative overflow-hidden rounded-[32px] px-[clamp(24px,5vw,48px)] py-[clamp(40px,7vw,72px)] text-center animate-gradientMove"
          style={{ background: 'linear-gradient(135deg,var(--lime),var(--lime-deep),var(--lime))', backgroundSize: '220% 220%', boxShadow: '0 30px 70px -30px var(--lime)' }}
        >
          <div className="pointer-events-none absolute -left-[30px] -top-[50px] h-[240px] w-[240px] rounded-full bg-white/15" />
          <div className="pointer-events-none absolute -bottom-[60px] -right-5 h-[260px] w-[260px] rounded-full" style={{ background: 'rgba(12,29,21,0.12)' }} />
          <div className="relative z-[1]">
            <h2 className="mb-4 font-display text-[clamp(34px,5vw,56px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#0c1d15]">
              Small actions. Real impact.
            </h2>
            <p className="mx-auto mb-8 max-w-[520px] text-[clamp(16px,2vw,19px)] font-medium leading-[1.55] text-[#163224]">
              Start tracking your daily footprint and build better habits with Carbonexo.
            </p>
            <div className="flex flex-wrap justify-center gap-3.5">
              <Link href="/onboarding" className="rounded-[14px] bg-[#0c1d15] px-[30px] py-4 text-base font-bold text-white transition-transform hover:-translate-y-0.5">
                Start Tracking Now →
              </Link>
              <button
                onClick={promptInstall}
                className="inline-flex items-center gap-2 rounded-[14px] bg-white/90 px-7 py-4 text-base font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5"
              >
                ⬇️ {installed ? 'Installed' : 'Install as PWA'}
              </button>
            </div>
          </div>
        </div>
      </Reveal>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-7">
        <Link href="/"><Logo size={30} /></Link>
        <div className="text-[13px] text-muted">Track your footprint. Reduce your impact. © 2026 Carbonexo</div>
      </footer>
    </section>
  );
}
