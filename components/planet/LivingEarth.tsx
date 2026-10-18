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
 * Two ways to steer the camera:
 *   - declaratively, with `region` / `selectedIso` (the camera springs there), or
 *   - imperatively, by passing `anchorRef` and writing to it — the scroll
 *     journey does this so scrolling never re-renders React.
 *
 * When `interactive`, the globe is a focusable control: arrow keys spin it
 * (with momentum), +/− zoom, 0 recentres. Everything it shows is also
 * available as text elsewhere on the page, so it is labelled as an image.
 */

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MutableRefObject, type ReactNode } from 'react';
import { useMotionTier } from '@/lib/useMotionTier';
import { earthQuality, EARTH_IMAGERY_CREDIT } from '@/lib/experience/quality';
import { COUNTRY_CO2 } from '@/lib/experience/co2';
import { OVERVIEW, type Region } from '@/lib/experience/regions';
import type { GlobeAnchor, GlobeBody } from '@/lib/physics/globe';
import { EarthPoster } from './EarthPoster';
import styles from './planet.module.css';
import type { EarthLayer, RouteArc } from './EarthCanvas';

export type { EarthLayer, RouteArc } from './EarthCanvas';

const EarthCanvas = dynamic(() => import('./EarthCanvas'), { ssr: false, loading: () => null });

/** Below this width the globe is a panel, not a hero, and 2K textures are indistinguishable from 4K. */
const COMPACT_GLOBE_PX = 720;
/** Below this width it is an icon: the poster looks the same, and a WebGL scene would cost ~300 ms per mount. */
const MIN_3D_GLOBE_PX = 120;

export interface LivingEarthProps {
  /** Where the camera looks. Changing it flies the camera there. */
  region?: Region;
  /** External camera control; overrides `region`/`selectedIso` framing. */
  anchorRef?: MutableRefObject<GlobeAnchor>;
  /** Drag to spin, keyboard control. Safe behind scrolling content: touch only takes horizontal drags. */
  interactive?: boolean;
  /** Wheel / pinch zoom and on-screen zoom buttons. Only where the globe owns the gesture. */
  zoomable?: boolean;
  /** Data layer. `showCo2` is the older spelling of `layer="co2"`. */
  layer?: EarthLayer;
  showCo2?: boolean;
  /** ISO code of the selected country; the camera flies to it. */
  selectedIso?: string | null;
  onSelectCountry?: (iso: string) => void;
  route?: RouteArc | null;
  /** Accessible description of what the globe is showing in this context. */
  label?: string;
  /** Show the imagery credit line under the globe. */
  credit?: boolean;
  className?: string;
  /**
   * Living World health, 0 (degraded) … 1 (lush); 0.5 is the unaltered
   * imagery. Pass a number when it comes from data (it springs to the new
   * value), or `vitalityRef` when a page drives it per scroll frame.
   */
  vitality?: number;
  vitalityRef?: MutableRefObject<number>;
  /** Increment to give the planet a physical nudge — feedback for a user action. */
  pulse?: number;
  /** Clear colour behind the 3D planet. */
  background?: string;
  /** Fixed CSS width for the static poster, when the page frames it itself (see PlanetJourney). */
  posterSize?: string;
}

export function LivingEarth({
  region = OVERVIEW,
  anchorRef: externalAnchor,
  interactive = false,
  zoomable = false,
  layer,
  showCo2 = false,
  selectedIso = null,
  onSelectCountry,
  route = null,
  label = 'A globe of Earth showing the current day and night sides.',
  credit = false,
  className = '',
  vitality,
  vitalityRef: externalVitality,
  pulse = 0,
  background,
  posterSize,
}: LivingEarthProps) {
  const tier = useMotionTier();
  const ownVitality = useRef(vitality ?? 0.5);
  if (vitality !== undefined) ownVitality.current = vitality;
  const vitalityRef = externalVitality ?? ownVitality;
  const [coarse, setCoarse] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [near, setNear] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<GlobeBody | null>(null);

  useEffect(() => {
    setCoarse(window.matchMedia('(pointer: coarse)').matches);
    const onVis = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Two distances: `onScreen` pauses the render loop; `near` mounts/unmounts
  // the canvas entirely. A live WebGL context with 4K textures holds ~250 MB
  // of GPU memory, so only globes near the viewport exist at all.
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

  // Build the 3D globe only once the page has painted and the browser is idle:
  // shader compiles and texture uploads block the main thread, and doing them
  // in the same frame as a navigation made every click into a globe page feel
  // stuck. The poster covers the gap, and the canvas fades in when ready.
  // The box is measured here too, so a panel-sized globe gets panel-sized textures.
  const [settled, setSettled] = useState(false);
  const [compact, setCompact] = useState(false);
  const [tiny, setTiny] = useState(false);
  useEffect(() => {
    const el = box.current;
    const width = el ? el.getBoundingClientRect().width : COMPACT_GLOBE_PX; // unmeasured: treat as a hero
    setCompact(width < COMPACT_GLOBE_PX);
    setTiny(width < MIN_3D_GLOBE_PX);
    // A hero globe is the first thing the page shows: mount it now rather than after the poster.
    if (width >= COMPACT_GLOBE_PX) {
      setSettled(true);
      return;
    }
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setSettled(true), { timeout: 1200 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setSettled(true), 200);
    return () => window.clearTimeout(id);
  }, []);

  const quality = earthQuality(tier, { coarsePointer: coarse, compact });
  const use3d = quality.webgl && !failed && !tiny;
  const mount3d = use3d && near && settled;

  // Declarative framing → an anchor. Ignored when the page steers via anchorRef.
  const ownAnchor = useMemo<GlobeAnchor>(() => {
    const country = selectedIso ? COUNTRY_CO2.find((c) => c.iso === selectedIso) : undefined;
    if (country) return { key: `iso:${country.iso}`, lat: country.at.lat, lon: country.at.lon, dist: 3.4 };
    return {
      key: `region:${region.id}`,
      lat: region.at.lat,
      lon: region.at.lon,
      dist: region.distance,
      drift: region.id === OVERVIEW.id ? (quality.spin * 180) / Math.PI : 0,
    };
  }, [selectedIso, region, quality.spin]);
  const internalAnchor = useRef<GlobeAnchor>(ownAnchor);
  internalAnchor.current = ownAnchor;
  const anchorRef = externalAnchor ?? internalAnchor;

  // A user action gives the planet a push: the GlobeBody glides off with
  // momentum and friction brings it back to its drift — no tween, no timer.
  useEffect(() => {
    if (pulse > 0) bodyRef.current?.nudge(0.55, 0.06);
  }, [pulse]);

  const onReady = useCallback(() => setReady(true), []);
  const onContextLost = useCallback(() => setFailed(true), []);

  const live = mount3d && ready;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const b = bodyRef.current;
    if (!b) return;
    const k = 0.9; // rad/s per press — a firm push that glides ~30°
    const zoomKey = e.key === '+' || e.key === '=' || e.key === '-';
    if (zoomKey && !zoomable) return;
    const map: Record<string, () => void> = {
      ArrowLeft: () => b.nudge(-k, 0),
      ArrowRight: () => b.nudge(k, 0),
      ArrowUp: () => b.nudge(0, k * 0.6),
      ArrowDown: () => b.nudge(0, -k * 0.6),
      '+': () => b.zoomBy(0.85),
      '=': () => b.zoomBy(0.85),
      '-': () => b.zoomBy(1 / 0.85),
      '0': () => b.recenter(),
      Home: () => b.recenter(),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  const posterAnchor = externalAnchor ? externalAnchor.current : ownAnchor;

  return (
    <figure
      className={`relative m-0 ${className}`}
      // The poster reads --vitality; a page that drives vitalityRef sets the variable on an ancestor.
      style={vitality !== undefined ? ({ '--vitality': String(Math.max(0, Math.min(1, vitality))) } as React.CSSProperties) : undefined}
    >
      <div
        ref={box}
        role="img"
        aria-label={
          interactive && live
            ? `${label} Interactive: drag or use the arrow keys to turn it${zoomable ? ', plus and minus to zoom' : ''}, 0 to recentre.`
            : label
        }
        tabIndex={interactive && live ? 0 : undefined}
        onKeyDown={interactive ? onKeyDown : undefined}
        className="relative h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--lime)]"
      >
        {/* Poster: the whole experience when 3D is unavailable; a placeholder while it loads. */}
        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-700 ease-out"
          style={{ opacity: live ? 0 : 1, pointerEvents: 'none' }}
        >
          <div key={pulse} className={`flex h-full w-full items-center justify-center ${pulse > 0 && tier !== 'still' ? styles.pulse : ''}`}>
            <EarthPoster
              center={{ lat: posterAnchor.lat, lon: posterAnchor.lon }}
              spinning={tier === 'lite'}
              size={posterSize ?? `min(86%, ${Math.round((100 / posterAnchor.dist) * 2.6)}%)`}
            />
          </div>
        </div>

        {mount3d && (
          <div className="absolute inset-0 transition-opacity duration-700 ease-out" style={{ opacity: ready ? 1 : 0 }}>
            <WebGLBoundary onError={onContextLost}>
              <EarthCanvas
                quality={quality}
                anchorRef={anchorRef}
                bodyRef={bodyRef}
                active={onScreen && tabVisible}
                interactive={interactive}
                zoomable={zoomable}
                layer={layer ?? (showCo2 ? 'co2' : 'none')}
                selectedIso={selectedIso}
                onSelectCountry={onSelectCountry}
                route={route}
                onReady={onReady}
                onContextLost={onContextLost}
                vitalityRef={vitalityRef}
                background={background}
              />
            </WebGLBoundary>
          </div>
        )}
      </div>

      {zoomable && live && (
        <div className="absolute bottom-4 right-4 z-[3] flex flex-col overflow-hidden rounded-[12px] border border-white/15 bg-[rgba(4,10,8,0.7)] text-white backdrop-blur-md">
          <ZoomButton label="Zoom in" onClick={() => bodyRef.current?.zoomBy(0.8)}>
            +
          </ZoomButton>
          <ZoomButton label="Zoom out" onClick={() => bodyRef.current?.zoomBy(1.25)}>
            −
          </ZoomButton>
          <ZoomButton label="Recentre" onClick={() => bodyRef.current?.recenter()}>
            ⌖
          </ZoomButton>
        </div>
      )}

      {credit && (
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-2 px-4 text-center font-mono text-[10px] leading-[1.5] text-white/40">
          {EARTH_IMAGERY_CREDIT}
        </figcaption>
      )}
    </figure>
  );
}

function ZoomButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center border-white/10 text-[18px] font-bold transition-colors hover:bg-white/10 focus-visible:bg-white/15 focus-visible:outline-none [&:not(:last-child)]:border-b"
    >
      {children}
    </button>
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
