'use client';

/**
 * The full cinematic landing, composed from the experience modules. Mount it
 * as a page body; it brings its own header and footer. Every section is also
 * exported individually so an integrator can recompose (see
 * docs/experience-integration.md).
 */

import Link from 'next/link';
import { CinematicHero } from './CinematicHero';
import { RegionTour } from './RegionTour';
import { PlanetData } from './PlanetData';
import { MediaSlot } from './MediaSlot';
import { ImpactPreview } from './ImpactPreview';
import { Logo } from '@/components/Logo';

export function ExperienceLanding({ ctaHref = '/onboarding' }: { ctaHref?: string }) {
  return (
    <div className="relative min-h-screen text-white" style={{ background: 'var(--void)' }}>
      <ExperienceHeader ctaHref={ctaHref} />
      <main>
        <CinematicHero ctaHref={ctaHref} />
        <RegionTour />
        <Interlude />
        <PlanetData />
        <ImpactPreview />
        <Closing ctaHref={ctaHref} />
      </main>
    </div>
  );
}

function ExperienceHeader({ ctaHref }: { ctaHref: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[rgba(4,8,12,0.55)] backdrop-blur-xl">
      <nav aria-label="Experience" className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-6 py-3">
        <Link href="/" aria-label="Carbonexo home" className="text-white">
          <Logo size={30} />
        </Link>
        <div className="hidden items-center gap-7 text-[14px] font-semibold text-white/70 md:flex">
          <a href="#tour" className="hover:text-white">Tour</a>
          <a href="#explore" className="hover:text-white">Real data</a>
          <a href="#impact" className="hover:text-white">Your impact</a>
        </div>
        <Link
          href={ctaHref}
          className="rounded-[12px] px-4 py-2.5 text-[14px] font-bold text-[#04170f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint)]"
          style={{ background: 'var(--mint)' }}
        >
          Get started
        </Link>
      </nav>
    </header>
  );
}

/** A breath between the tour and the data — generated landscape if available, rendered canopy otherwise. */
function Interlude() {
  return (
    <section aria-label="Interlude" className="relative h-[70svh] overflow-hidden">
      <MediaSlot
        id="interlude-canopy"
        className="absolute inset-0"
        fallback={
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(70% 55% at 60% 100%, rgba(245,199,104,0.35) 0%, transparent 60%), linear-gradient(180deg, var(--void) 0%, var(--midnight) 30%, var(--canopy-deep) 78%, var(--canopy) 100%)',
            }}
          >
            <svg viewBox="0 0 1200 300" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[45%] w-full">
              <path d="M0 210 C120 170 220 200 330 175 S560 150 680 180 S920 140 1040 170 S1160 160 1200 150 V300 H0Z" fill="var(--canopy)" opacity="0.7" />
              <path d="M0 250 C160 220 300 245 450 225 S720 210 860 235 S1080 215 1200 225 V300 H0Z" fill="var(--canopy-deep)" />
            </svg>
          </div>
        }
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--void)] via-transparent to-[var(--void)]" aria-hidden="true" />
      <div className="relative z-[1] mx-auto flex h-full max-w-[900px] items-center justify-center px-6 text-center">
        <p className="font-display text-[clamp(26px,4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-white" style={{ textWrap: 'balance' }}>
          None of these places is far from your daily choices.
        </p>
      </div>
    </section>
  );
}

function Closing({ ctaHref }: { ctaHref: string }) {
  return (
    <section aria-labelledby="closing-title" className="relative overflow-hidden px-6 pb-16 pt-[16vh] text-center">
      <MediaSlot id="cta-dawn" className="absolute inset-0 opacity-60" fallback={null} />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'radial-gradient(80% 55% at 50% 100%, rgba(245,199,104,0.4) 0%, rgba(224,154,60,0.12) 40%, transparent 70%)' }}
      />
      <div className="relative z-[1] mx-auto max-w-[760px]">
        <h2 id="closing-title" className="font-display text-[clamp(36px,6vw,72px)] font-extrabold leading-[0.98] tracking-[-0.035em]">
          Start with one day.
        </h2>
        <p className="mx-auto mt-6 max-w-[48ch] text-[17px] leading-[1.6] text-white/72">
          Log what you did today. Carbonexo shows your footprint, the swaps that matter most for you, and how they add up.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href={ctaHref} className="rounded-[14px] px-7 py-4 text-base font-bold text-[#04170f]" style={{ background: 'var(--mint)' }}>
            Begin your journey →
          </Link>
          <Link href="/login" className="rounded-[14px] border border-white/20 bg-white/5 px-[26px] py-4 text-base font-semibold text-white/90">
            I have an account
          </Link>
        </div>
      </div>
      <footer className="relative z-[1] mx-auto mt-[14vh] flex max-w-[1240px] flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-[12.5px] text-white/45">
        <span>© 2026 Carbonexo</span>
        <span>Earth imagery: NASA (public domain). Emissions data: Our World in Data / Global Carbon Project (CC BY 4.0).</span>
      </footer>
    </section>
  );
}
