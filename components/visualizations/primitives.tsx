'use client';

/**
 * Shared shells for the impact visualizations: card, header, skeleton and
 * empty state. Theme-aware (bg-surface / text-text / border-border), so the
 * components sit inside existing app screens in light and dark mode.
 */

import type { ReactNode } from 'react';
import type { Basis } from '@/lib/experience/types';

export const VIZ_PALETTE = ['var(--lime)', 'var(--blue)', '#8fc9a0', '#e0a86a', '#9b8cd6', '#5fd3e8'];

export function VizCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  labelledBy,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`rounded-[22px] border border-border bg-surface p-5 text-text shadow-soft sm:p-6 ${className}`}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={labelledBy} className="text-[15px] font-bold leading-tight">
            {title}
          </h3>
          {subtitle && <p className="mt-1 text-[12.5px] leading-[1.45] text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-[10px] bg-surface2 ${className}`} />;
}

export function LoadingBody({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={i === 0 ? 'h-20' : 'h-4'} />
      ))}
    </div>
  );
}

export function EmptyBody({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-border px-4 py-6 text-center">
      <p className="text-[13.5px] leading-[1.5] text-muted">{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Says whether a number is measured from logs or estimated from a catalog. */
export function BasisChip({ basis }: { basis: Basis }) {
  const measured = basis === 'measured';
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em]"
      style={measured ? { background: 'var(--lime-soft)', color: 'var(--lime-deep)' } : { background: 'var(--surface2)', color: 'var(--muted)' }}
      title={measured ? 'Measured from your logged activity' : 'Estimated from typical savings — not measured'}
    >
      {measured ? 'measured' : 'estimate'}
    </span>
  );
}
