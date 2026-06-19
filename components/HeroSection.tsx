'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRef } from 'react';
import { Reveal } from './Reveal';
import { DashboardPreview } from './DashboardPreview';
import { useCountUp } from '@/lib/useCountUp';

function Stat({ to, decimals, suffix, label }: { to: number; decimals?: number; suffix?: string; label: string }) {
  const { ref, display } = useCountUp(to, { decimals, suffix });
  return (
    <div>
      <div className="font-display text-[23px] font-bold">
        <span ref={ref}>{display}</span>
      </div>
      <div className="text-[13px] text-muted">{label}</div>
    </div>
  );
}

export function HeroSection() {
  // mouse-parallax tilt on the dashboard cluster
  const sceneRef = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const s = sceneRef.current;
    if (!s) return;
    const r = s.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    s.style.transform = `perspective(1100px) rotateY(${Math.max(-1, Math.min(1, dx)) * 6}deg) rotateX(${Math.max(-1, Math.min(1, -dy)) * 6}deg)`;
  };
  const reset = () => {
    if (sceneRef.current) sceneRef.current.style.transform = 'perspective(1100px) rotateY(0deg) rotateX(0deg)';
  };

  return (
    <header className="mx-auto max-w-[1200px] px-6 pb-10 pt-16" onMouseMove={onMove} onMouseLeave={reset}>
      <div className="grid items-center gap-12 [grid-template-columns:repeat(auto-fit,minmax(330px,1fr))]">
        <Reveal>
          <div className="mb-[26px] inline-flex items-center gap-2 rounded-full border border-border bg-lime-soft px-3.5 py-[7px] text-[13px] font-semibold text-lime-deep">
            <span className="h-[7px] w-[7px] rounded-full bg-lime" />
            Your daily carbon companion
          </div>
          <h1 className="mb-[22px] font-display text-[clamp(40px,5.6vw,66px)] font-extrabold leading-[1.02] tracking-[-0.03em]">
            Track your footprint.
            <br />
            <span className="text-lime">Reduce your impact.</span>
          </h1>
          <p className="mb-8 max-w-[460px] text-[clamp(16px,2vw,18px)] leading-[1.6] text-muted">
            Carbonexo helps you track daily activities, understand your carbon footprint, and reduce
            emissions through simple actions and personalized AI insights.
          </p>
          <div className="mb-9 flex flex-wrap items-center gap-3.5">
            <Link
              href="/onboarding"
              className="relative overflow-hidden rounded-[14px] bg-lime px-7 py-4 text-base font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5"
              style={{ boxShadow: '0 12px 30px -10px var(--lime)' }}
            >
              <span className="pointer-events-none absolute left-0 top-0 h-full w-2/5 animate-shineSweep bg-gradient-to-r from-transparent via-white/55 to-transparent" />
              Start Tracking →
            </Link>
            <a href="#journey" className="rounded-[14px] border border-border bg-surface px-[26px] py-4 text-base font-semibold text-text transition-colors hover:border-lime">
              See How It Works
            </a>
          </div>
          <div className="flex flex-wrap gap-[26px]">
            <Stat to={120} suffix="k+" label="daily trackers" />
            <div className="w-px bg-border" />
            <Stat to={2.4} decimals={1} suffix="M kg" label="CO₂ saved together" />
            <div className="w-px bg-border" />
            <Stat to={4.9} decimals={1} suffix="★" label="app rating" />
          </div>
        </Reveal>

        <Reveal delay={120}>
          <motion.div
            ref={sceneRef}
            className="relative flex min-h-[480px] items-center justify-center [transform-style:preserve-3d] [transition:transform_.3s_cubic-bezier(.2,.7,.2,1)]"
          >
            <DashboardPreview />
          </motion.div>
        </Reveal>
      </div>
    </header>
  );
}
