'use client';

/**
 * The Carbonexo landing: one planet, five scenes.
 *
 * A single Living Earth sits fixed behind the whole page (one WebGL context,
 * not one per section). Scroll position is mapped onto a camera path
 * (lib/experience/journey.ts) and written straight into the globe's anchor —
 * no React render per scroll — and the camera's spring physics turns that into
 * motion. The page never scroll-jacks: scroll stays native; the planet follows.
 *
 * Content columns are pointer-events-auto; the space around them falls
 * through to the planet, so you can grab and spin it anywhere there's no copy.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { LivingEarth, type EarthLayer, type RouteArc } from '@/components/planet/LivingEarth';
import { Logo } from '@/components/Logo';
import { useMotionTier } from '@/lib/useMotionTier';
import { subsolarPoint } from '@/lib/experience/sun';
import { COUNTRY_CO2 } from '@/lib/experience/co2';
import { tripView, TRIPS } from '@/lib/experience/trips';
import { SCENES, anchorAt, homeLongitude, keyframes, portraitScale, storyPosition, type SceneId } from '@/lib/experience/journey';
import type { GlobeAnchor } from '@/lib/physics/globe';
import { ScenePlanet } from './ScenePlanet';
import { SceneWorld, type WorldSelection } from './SceneWorld';
import { SceneFootprint } from './SceneFootprint';
import { SceneImpact } from './SceneImpact';
import { SceneFuture } from './SceneFuture';
import s from './journey.module.css';

const NAV: { id: SceneId; label: string }[] = [
  { id: 'world', label: 'Your world' },
  { id: 'footprint', label: 'Footprint' },
  { id: 'impact', label: 'Impact' },
  { id: 'future', label: 'Together' },
];

export function PlanetJourney() {
  const tier = useMotionTier();
  const [narrow, setNarrow] = useState(false);
  const [ctx, setCtx] = useState({ homeLon: 20, sunriseLon: -60 });
  const [scene, setScene] = useState<SceneId>('planet');
  const [selection, setSelection] = useState<WorldSelection>({ tab: 'co2', iso: null, tripId: TRIPS[0].id, mode: 'Metro / Train' });

  // Viewer context is only knowable in the browser; read it after mount.
  useEffect(() => {
    const sun = subsolarPoint();
    let sunrise = sun.lon - 90;
    if (sunrise < -180) sunrise += 360;
    setCtx({ homeLon: homeLongitude(new Date().getTimezoneOffset()), sunriseLon: sunrise });
    const mq = window.matchMedia('(max-width: 860px), (orientation: portrait) and (max-width: 1024px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const frames = useMemo(() => keyframes({ ...ctx, narrow }), [ctx, narrow]);
  const anchorRef = useRef<GlobeAnchor>({ key: 'scene:planet', ...frames.planet });
  const scrim = useRef<HTMLDivElement>(null);
  const poster = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const sections = useRef<Partial<Record<SceneId, HTMLElement | null>>>({});
  const selRef = useRef(selection);
  selRef.current = selection;
  const sceneRef = useRef<SceneId>('planet');
  const tierRef = useRef(tier);
  tierRef.current = tier;

  /** Recompute the camera from the scroll position (and the World scene's selection). */
  const update = useCallback(() => {
    const vh = window.innerHeight;
    const centers = SCENES.map((id) => {
      const el = sections.current[id];
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return r.top + window.scrollY + Math.min(r.height, vh) / 2;
    });
    const pos = storyPosition(centers, window.scrollY + vh / 2);
    const { anchor, dim, scene: at } = anchorAt(frames, pos);

    // In the World scene, a selection takes the camera to it.
    const sel = selRef.current;
    let next = anchor;
    if (at === 'world') {
      const base = frames.world;
      if (sel.tab === 'trip') {
        const t = TRIPS.find((x) => x.id === sel.tripId) ?? TRIPS[0];
        const v = tripView(t);
        next = { ...base, key: `trip:${t.id}`, lat: v.at.lat, lon: v.at.lon, dist: v.distance, drift: 0 };
      } else if (sel.iso) {
        const c = COUNTRY_CO2.find((x) => x.iso === sel.iso);
        if (c) next = { ...base, key: `iso:${c.iso}`, lat: c.at.lat, lon: c.at.lon, dist: 2.3, drift: 0 };
      }
    }
    if (narrow) next = { ...next, dist: next.dist * portraitScale(window.innerWidth / vh) };
    anchorRef.current = next;

    if (scrim.current) scrim.current.style.opacity = String(dim);
    if (poster.current) {
      // The static fallback has no camera — slide the poster to the scene's framing instead.
      // With WebGL the projection does this, so the layer must stay put.
      poster.current.style.transform =
        tierRef.current === 'full' ? '' : `translate(${(next.frameX ?? 0) * 100}vw, ${-(next.frameY ?? 0) * 100}vh) scale(${Math.min(1.25, 3 / next.dist)})`;
    }
    if (progress.current) {
      const max = document.documentElement.scrollHeight - vh;
      progress.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    }
    if (at !== sceneRef.current) {
      sceneRef.current = at;
      setScene(at);
    }
  }, [frames, narrow]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [update]);

  // A new selection moves the camera even without a scroll.
  useEffect(() => {
    update();
  }, [selection, tier, update]);

  const layer: EarthLayer = scene === 'world' && selection.tab !== 'trip' ? selection.tab : 'none';
  const route: RouteArc | null = useMemo(() => {
    if (scene !== 'world' || selection.tab !== 'trip') return null;
    const t = TRIPS.find((x) => x.id === selection.tripId) ?? TRIPS[0];
    const color = selection.mode === 'Flight' ? '#f08a5d' : selection.mode === 'Car ride' ? '#f3b860' : '#4fd38a';
    return { key: `${t.id}:${selection.mode}`, from: t.from.at, to: t.to.at, color, pace: selection.mode === 'Flight' ? 0.34 : 0.22 };
  }, [scene, selection]);

  const register = (id: SceneId) => (el: HTMLElement | null) => {
    sections.current[id] = el;
  };

  return (
    // reducedMotion="user": framer drops transform/layout animation for viewers who asked for less motion,
    // without components branching their props on the preference (which breaks SSR hydration).
    <MotionConfig reducedMotion="user">
    <div className={`relative min-h-screen overflow-x-clip ${s.root}`}>
      <a
        href="#world"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-20 focus:z-[60] focus:rounded-lg focus:bg-lime focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-[#0c1d15]"
      >
        Skip the intro
      </a>
      <JourneyNav active={scene} progressRef={progress} />

      {/* The planet — one fixed layer behind every scene. */}
      <div className="fixed inset-0 z-0">
        <div ref={poster} className="absolute inset-0 transition-transform duration-700 ease-out motion-reduce:transition-none">
          <LivingEarth
            className="h-full w-full"
            anchorRef={anchorRef}
            interactive
            layer={layer}
            selectedIso={scene === 'world' && selection.tab !== 'trip' ? selection.iso : null}
            onSelectCountry={(iso) => setSelection((p) => ({ ...p, iso, tab: p.tab === 'trip' ? 'co2' : p.tab }))}
            route={route}
            label="Planet Earth, lit as it is right now."
          />
        </div>
        <div ref={scrim} aria-hidden className="pointer-events-none absolute inset-0 bg-[#030709] transition-opacity duration-300" style={{ opacity: 0 }} />
        {/* Edge vignette: copy columns always sit on calm darkness. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: narrow
              ? 'linear-gradient(0deg, rgba(3,7,9,0.95) 0%, rgba(3,7,9,0.75) 38%, rgba(3,7,9,0) 62%)'
              : 'linear-gradient(90deg, rgba(3,7,9,0.88) 0%, rgba(3,7,9,0.55) 30%, rgba(3,7,9,0) 52%)',
          }}
        />
      </div>

      <main className="pointer-events-none relative z-[1]">
        <ScenePlanet ref={register('planet')} />
        <SceneWorld ref={register('world')} selection={selection} onChange={setSelection} />
        <SceneFootprint ref={register('footprint')} />
        <SceneImpact ref={register('impact')} />
        <SceneFuture ref={register('future')} />
      </main>
    </div>
    </MotionConfig>
  );
}

// ─── Navigation — the original Carbonexo navbar, on the planet ──────────────

function JourneyNav({ active, progressRef }: { active: SceneId; progressRef: React.RefObject<HTMLDivElement> }) {
  const [open, setOpen] = useState(false);
  return (
    <nav aria-label="Main" className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-[rgba(3,7,9,0.72)] backdrop-blur-md">
      <div
        ref={progressRef}
        aria-hidden
        className="absolute -bottom-px left-0 h-[2px] w-full origin-left"
        style={{ transform: 'scaleX(0)', background: 'linear-gradient(90deg,var(--lime),var(--blue))' }}
      />
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-5 px-5 py-3 sm:px-6">
        <Link href="/welcome" aria-label="Carbonexo home" className="rounded-lg text-text">
          <Logo size={32} />
        </Link>
        <div className="hidden items-center gap-8 lg:flex">
          {NAV.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              aria-current={active === l.id ? 'true' : undefined}
              className="whitespace-nowrap text-[15px] font-semibold transition-colors hover:text-text"
              style={{ color: active === l.id ? 'var(--lime)' : 'var(--muted)' }}
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/login" className="hidden whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:text-text sm:inline-block">
            Sign in
          </Link>
          <Link
            href="/onboarding"
            className="hidden whitespace-nowrap rounded-xl bg-lime px-5 py-[11px] text-sm font-bold text-[#0c1d15] transition-transform hover:-translate-y-px md:inline-block"
          >
            Start Tracking
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-surface lg:hidden"
          >
            <span className="h-0.5 w-[18px] rounded bg-text" />
            <span className="h-0.5 w-[18px] rounded bg-text" />
            <span className="h-0.5 w-[18px] rounded bg-text" />
          </button>
        </div>
      </div>
      {open && (
        <div className="flex flex-col gap-1 border-t border-border bg-[#060e0b] px-6 pb-5 pt-3.5 lg:hidden">
          {NAV.map((l) => (
            <a key={l.id} href={`#${l.id}`} onClick={() => setOpen(false)} className="rounded-[10px] px-1.5 py-3 text-base font-semibold text-text">
              {l.label}
            </a>
          ))}
          <Link href="/login" onClick={() => setOpen(false)} className="rounded-[10px] px-1.5 py-3 text-base font-semibold text-muted">
            Sign in
          </Link>
          <Link href="/onboarding" onClick={() => setOpen(false)} className="mt-2 rounded-xl bg-lime py-3.5 text-center text-[15px] font-bold text-[#0c1d15]">
            Start Tracking
          </Link>
        </div>
      )}
    </nav>
  );
}
