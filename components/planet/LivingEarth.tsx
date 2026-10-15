'use client';

/**
 * <LivingEarth> — the one component screens mount.
 *
 * Chooses between the WebGL globe and the CSS poster, and owns every way the
 * 3D path can fail:
 *   - motion tier is `lite`/`still` (reduced motion, weak device, no WebGL) → poster
 *   - three.js chunk or textures still loading                              → poster underneath, canvas fades in on ready
 *   - far off screen                                                        → canvas unmounted (frees the GL context)
 *   - render throws                                                         → error boundary → poster
 *   - GPU drops the context                                                 → poster
 * It also stops the render loop when scrolled off screen or the tab is hidden.
 *
 * The globe is decorative-plus: everything it shows is also available as text
 * (pair it with <Co2Panel> for the data overlay), so it is aria-hidden behind
 * a descriptive label.
 */

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMotionTier } from '@/lib/useMotionTier';
import { earthQuality, EARTH_IMAGERY_CREDIT } from '@/lib/experience/quality';
import { COUNTRY_CO2 } from '@/lib/experience/co2';
import { OVERVIEW, type Region } from '@/lib/experience/regions';
import { EarthPoster } from './EarthPoster';
import type { CameraTarget } from './EarthCanvas';

const EarthCanvas = dynamic(() => import('./EarthCanvas'), { ssr: false, loading: () => null });

export interface LivingEarthProps {
  /** Where the camera looks. Changing it flies the camera there. */
  region?: Region;
  /** Allow drag-to-orbit and zoom. Leave off where the globe sits behind scrolling content. */
  interactive?: boolean;
  /** Show per-person CO₂ markers (real data — see lib/experience/co2.ts). */
  showCo2?: boolean;
  /** ISO code of the selected country; the camera flies to it. */
  selectedIso?: string | null;
  onSelectCountry?: (iso: string) => void;
  /** Accessible description of what the globe is showing in this context. */
  label?: string;
  /** Show the imagery credit line under the globe. */
  credit?: boolean;
  className?: string;
}

export function LivingEarth({
  region = OVERVIEW,
  interactive = false,
  showCo2 = false,
  selectedIso = null,
  onSelectCountry,
  label = 'A globe of Earth showing the current day and night sides.',
  credit = false,
  className = '',
}: LivingEarthProps) {
  const tier = useMotionTier();
  const [coarse, setCoarse] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [near, setNear] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCoarse(window.matchMedia('(pointer: coarse)').matches);
    const onVis = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Two distances: `onScreen` pauses the render loop; `near` mounts/unmounts
  // the canvas entirely. A page can carry several globes, and a live WebGL
  // context with 4K textures holds ~250 MB of GPU memory — so only the ones
  // near the viewport exist at all. Textures stay in the loader cache, so a
  // remount is quick.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const visible = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: '120px 0px' });
    const nearby = new IntersectionObserver(
      ([e]) => {
        setNear(e.isIntersecting);
        if (!e.isIntersecting) setReady(false);
      },
      { rootMargin: '75% 0px' }
    );
    visible.observe(el);
    nearby.observe(el);
    return () => {
      visible.disconnect();
      nearby.disconnect();
    };
  }, []);

  const quality = earthQuality(tier, { coarsePointer: coarse });
  const use3d = quality.webgl && !failed;
  const mount3d = use3d && near;

  const target: CameraTarget = useMemo(() => {
    const country = selectedIso ? COUNTRY_CO2.find((c) => c.iso === selectedIso) : undefined;
    return country ? { at: country.at, distance: 3.6 } : { at: region.at, distance: region.distance };
  }, [selectedIso, region]);

  const onReady = useCallback(() => setReady(true), []);
  const onContextLost = useCallback(() => setFailed(true), []);

  return (
    <figure className={`relative m-0 ${className}`}>
      <div ref={box} role="img" aria-label={label} className="relative h-full w-full">
        {/* Poster: the whole experience when 3D is unavailable; a placeholder while it loads. */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-xl ease-out"
          style={{ opacity: mount3d && ready ? 0 : 1, pointerEvents: 'none' }}
        >
          <EarthPoster
            center={selectedIso ? target.at : region.at}
            spinning={tier === 'lite'}
            size={`min(86%, ${Math.round((100 / target.distance) * 2.6)}%)`}
          />
        </div>

        {mount3d && (
          <div className="absolute inset-0 transition-opacity duration-xl ease-out" style={{ opacity: ready ? 1 : 0 }}>
            <WebGLBoundary onError={onContextLost}>
              <EarthCanvas
                quality={quality}
                target={target}
                active={onScreen && tabVisible}
                interactive={interactive}
                showCo2={showCo2}
                selectedIso={selectedIso}
                onSelectCountry={onSelectCountry}
                onReady={onReady}
                onContextLost={onContextLost}
              />
            </WebGLBoundary>
          </div>
        )}
      </div>
      {credit && (
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-2 px-4 text-center font-mono text-[10px] leading-[1.5] text-white/45">
          {EARTH_IMAGERY_CREDIT}
        </figcaption>
      )}
    </figure>
  );
}

class WebGLBoundary extends Component<{ onError: () => void; children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('[LivingEarth] 3D globe failed; showing the static globe instead.', error);
    this.props.onError();
  }
  render() {
    return this.state.broken ? null : this.props.children;
  }
}
