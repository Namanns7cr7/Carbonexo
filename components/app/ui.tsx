'use client';

import type { ReactNode } from 'react';

/** Standard themed surface card. */
export function Card({ children, className = '', as: As = 'div', ...rest }: { children: ReactNode; className?: string; as?: 'div' | 'section'; [k: string]: unknown }) {
  return (
    <As className={`rounded-[20px] border border-border bg-surface p-5 shadow-soft ${className}`} {...rest}>
      {children}
    </As>
  );
}

/** Mono eyebrow label used across screens. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="mb-2 font-mono text-xs uppercase tracking-[0.16em] text-lime">{children}</div>;
}

/** Page heading block. */
export function PageHead({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="font-display text-[clamp(26px,4vw,38px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{title}</h1>
      {sub && <p className="mt-2 max-w-[560px] text-[15px] leading-[1.55] text-muted">{sub}</p>}
    </div>
  );
}

/** Centered branded loading state (used while the store hydrates). */
export function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="flex flex-col items-center gap-3">
        <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-border border-t-lime" />
        <span className="text-sm font-semibold text-muted">Loading Carbonexo…</span>
      </div>
    </div>
  );
}

/** Empty-state block. */
export function EmptyState({ emoji, title, sub, action }: { emoji: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-border bg-surface2 px-6 py-10 text-center">
      <div className="text-4xl">{emoji}</div>
      <div className="text-[15px] font-bold">{title}</div>
      {sub && <p className="max-w-[340px] text-sm text-muted">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
