'use client';

/**
 * <PlanetPanel> — the Living World on a product screen.
 *
 * A compact LivingEarth driven by a WorldVisual, its provenance badge, a
 * caption, and a "Why does it look like this?" disclosure carrying the exact
 * basis. Every screen that shows the planet uses this, so there is one
 * renderer and one explanation, not several.
 */

import { useId, useState, type ReactNode } from 'react';
import { LivingEarth } from '@/components/planet/LivingEarth';
import type { WorldVisual } from '@/lib/living-world/types';
import { ProvenanceBadge } from './Provenance';

export interface PlanetPanelProps {
  visual: WorldVisual;
  /** Increment for physical feedback (the planet takes a push). */
  pulse?: number;
  title?: string;
  /** Pixel size of the planet square. */
  size?: number;
  /** Let the user spin it. */
  interactive?: boolean;
  /** Extra content under the caption (stats, links). */
  children?: ReactNode;
  className?: string;
  /** Hide the card chrome when the panel sits inside an existing card. */
  bare?: boolean;
}

export function PlanetPanel({ visual, pulse = 0, title = 'Your planet', size = 180, interactive = true, children, className = '', bare = false }: PlanetPanelProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <section
      aria-label={title}
      className={`${bare ? '' : 'rounded-[22px] border border-border p-4'} flex flex-col items-center text-center ${className}`}
      style={bare ? undefined : { background: 'radial-gradient(120% 90% at 50% 0%, rgba(16,48,36,0.55), var(--card) 70%)' }}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{title}</span>
        <ProvenanceBadge provenance={visual.provenance} />
      </div>
      <div className="relative my-2 overflow-hidden rounded-full" style={{ width: size, height: size }}>
        <LivingEarth
          className="h-full w-full"
          vitality={visual.vitality}
          pulse={pulse}
          interactive={interactive}
          background="#06120e"
          label={`${title}. ${visual.basis}`}
        />
      </div>
      <p className="text-[12px] font-semibold leading-snug text-text">{visual.caption}</p>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="mt-1.5 rounded-md text-[11px] font-bold text-lime-deep underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
      >
        {open ? 'Hide explanation' : 'Why does it look like this?'}
      </button>
      {open && (
        <p id={id} className="mt-1.5 text-left text-[11.5px] leading-relaxed text-muted">
          {visual.basis}
          {(visual.provenance === 'logged' || visual.provenance === 'example') &&
            ' The planet greens as the average per logged day falls toward the budget. Logging more often does not change it by itself.'}
        </p>
      )}
      {children}
    </section>
  );
}
