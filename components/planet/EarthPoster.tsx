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

  return (
    <div aria-hidden="true" className="relative" style={{ width: size, aspectRatio: '1' }}>
      <div
        className="absolute -inset-[7%] rounded-full"
        style={{ background: 'radial-gradient(circle, transparent 60%, rgba(95,170,232,0.32) 68%, transparent 76%)', filter: 'blur(10px)' }}
      />
      <div className="absolute inset-0 overflow-hidden rounded-full" style={{ background: '#0d3146' }}>
        <div
          className={`absolute inset-y-0 left-0 ${spinning ? styles.posterSpin : ''}`}
          style={
            {
              width: `${COPIES * 200}%`,
              backgroundImage: `url(${EARTH_TEXTURES['2k'].day})`,
              backgroundSize: `${100 / COPIES}% 100%`,
              backgroundRepeat: 'repeat-x',
              transform: `translateX(${shift}%)`,
              '--poster-from': `${shift}%`,
              '--poster-to': `${shift + 100 / COPIES}%`,
            } as React.CSSProperties
          }
        />
        {/* sphere shading: limb darkening + real day/night */}
        <div
          className="absolute inset-0"
          style={{
            background: sunBehind
              ? 'radial-gradient(circle at 50% 50%, rgba(2,6,10,0.55), rgba(2,6,10,0.9) 70%)'
              : `radial-gradient(circle at ${sx}% ${sy}%, rgba(255,255,255,0.10) 0%, transparent 34%, rgba(2,6,10,0.35) 58%, rgba(2,6,10,0.88) 82%)`,
          }}
        />
        <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 40px 10px rgba(2,6,10,0.6), inset 0 0 6px 1px rgba(140,200,255,0.35)' }} />
      </div>
    </div>
  );
}
