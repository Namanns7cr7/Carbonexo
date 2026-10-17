'use client';

/**
 * The Living Earth without WebGL — for `lite` / `still` tiers, browsers with
 * WebGL disabled, a lost GL context, and the moment before textures load.
 *
 * Same NASA imagery as the 3D globe, wrapped onto a CSS disc: an inner strip
 * of the equirectangular map slides behind a circular mask. Shading follows
 * the real subsolar point relative to the longitude in view, so even the
 * fallback's day side is honest. At `still` nothing moves.
 */

import { useEffect, useState } from 'react';
import { subsolarPoint } from '@/lib/experience/sun';
import { EARTH_TEXTURES } from '@/lib/experience/quality';
import styles from './planet.module.css';
import type { LatLon } from '@/lib/experience/geo';

/** Copies of the map laid side by side; each copy is 2 disc-widths wide. */
const COPIES = 4;

export function EarthPoster({
  center,
  spinning,
  size = '100%',
  date,
}: {
  /** Longitude/latitude to face the viewer. */
  center: LatLon;
  spinning: boolean;
  size?: string;
  /** Fixed time for the terminator (tests, SSR snapshots). Defaults to now. */
  date?: Date;
}) {
  // Disc-widths from the strip's left edge to the visible left edge, centred
  // on `center.lon`, starting two copies in so the spin has room to travel.
  const u = (center.lon + 180) / 360;
  const leftInDiscs = 4 + u * 2 - 0.5;
  const shift = -(leftInDiscs / (COPIES * 2)) * 100;

  // The terminator depends on the clock, which the server and the browser
  // disagree on — so the server renders neutral front lighting and the real
  // sun position is applied after mount.
  const [now, setNow] = useState<Date | null>(date ?? null);
  useEffect(() => {
    if (!date) setNow(new Date());
  }, [date]);

  // Where the sun sits on the visible disc, from the real subsolar point.
  const sun = now ? subsolarPoint(now) : { lat: center.lat * 0.4, lon: center.lon - 35 };
  const dLon = ((((sun.lon - center.lon + 180) % 360) + 360) % 360) - 180;
  const sx = 50 + 46 * Math.sin((Math.max(-90, Math.min(90, dLon)) * Math.PI) / 180);
  const sy = 50 - 40 * Math.sin((sun.lat * Math.PI) / 180);
  const sunBehind = Math.abs(dLon) > 90;
  // Daylight fades over ~30% of the disc around the terminator, like civil twilight.
  const dayMask = sunBehind
    ? 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.06), transparent 60%)'
    : `radial-gradient(circle at ${sx}% ${sy}%, #000 0%, #000 ${Math.round(30 + (90 - Math.abs(dLon)) * 0.35)}%, transparent ${Math.round(62 + (90 - Math.abs(dLon)) * 0.35)}%)`;

  return (
    <div aria-hidden="true" data-earth-poster className="relative" style={{ width: size, aspectRatio: '1' }}>
      <div
        className="absolute -inset-[7%] rounded-full"
        style={{
          // A thin, bright atmosphere hugging the limb (not a blurred donut). Its tint
          // follows health: cool grey haze when low, blue-emerald when alive.
          background:
            'radial-gradient(circle, transparent 62.5%, color-mix(in srgb, rgba(120,190,255,0.55) calc(var(--vitality, 0.5) * 100%), rgba(90,130,180,0.42)) 67.5%, transparent 71.5%)',
          filter: 'blur(3px)',
        }}
      />
      <div className={`absolute inset-0 overflow-hidden rounded-full ${styles.living}`} style={{ background: '#0d3146' }}>
        {/* Night: the Black Marble city lights, everywhere underneath. */}
        <MapStrip url={EARTH_TEXTURES['2k'].night} shift={shift} spinning={spinning} />
        {/* Day: the Blue Marble, revealed only around the real sun position, so the
            terminator falls where it does on the planet right now. */}
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage: dayMask,
            maskImage: dayMask,
          }}
        >
          <MapStrip url={EARTH_TEXTURES['2k'].day} shift={shift} spinning={spinning} />
        </div>
        {/* sphere shading: limb darkening */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, transparent 52%, rgba(2,6,10,0.45) 78%, rgba(2,6,10,0.85) 100%)' }} />
        {/* sphere: a soft specular bloom on the lit side, a curved terminator shadow, and a lit limb */}
        <div
          className="absolute inset-0"
          style={{
            background: sunBehind
              ? 'none'
              : `radial-gradient(circle at ${sx}% ${sy}%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 14%, transparent 30%)`,
            mixBlendMode: 'screen',
          }}
        />
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset -18px -10px 60px 12px rgba(2,6,10,0.7), inset 0 0 3px 1px rgba(150,205,255,0.55), inset 0 0 18px 2px rgba(110,180,255,0.18)' }} />
      </div>
    </div>
  );
}

/** One copy-strip of an equirectangular map, slid so `shift` centres the view. */
function MapStrip({ url, shift, spinning }: { url: string; shift: number; spinning: boolean }) {
  return (
    <div
      className={`absolute inset-y-0 left-0 ${spinning ? styles.posterSpin : ''}`}
      style={
        {
          width: `${COPIES * 200}%`,
          backgroundImage: `url(${url})`,
          backgroundSize: `${100 / COPIES}% 100%`,
          backgroundRepeat: 'repeat-x',
          transform: `translateX(${shift}%)`,
          '--poster-from': `${shift}%`,
          '--poster-to': `${shift + 100 / COPIES}%`,
        } as React.CSSProperties
      }
    />
  );
}
