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

/** Small pill-style segmented control (e.g. window/metric toggles). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border bg-surface2 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
            value === o.id ? 'bg-lime text-[#0c1d15]' : 'text-muted hover:text-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const BUTTON_VARIANT: Record<string, string> = {
  primary: 'bg-lime text-[#0c1d15] hover:-translate-y-0.5',
  secondary: 'border border-border bg-surface text-text hover:border-lime',
  ghost: 'bg-transparent text-muted hover:text-text hover:bg-surface2',
  danger: 'bg-danger text-white hover:-translate-y-0.5',
};

const BUTTON_SIZE: Record<string, string> = {
  sm: 'px-3.5 py-2 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-5 py-3 text-sm',
};

/** Themed button — consolidates the hand-rolled button classes used across the app. */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  as: As = 'button',
  ...rest
}: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children: ReactNode;
  as?: 'button' | 'a';
  [k: string]: unknown;
}) {
  return (
    <As
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </As>
  );
}

/** Empty-state block. `emoji` accepts a literal emoji string (legacy usage) or a ReactNode (e.g. a lucide icon). */
export function EmptyState({ emoji, title, sub, action }: { emoji: ReactNode; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-border bg-surface2 px-6 py-10 text-center">
      <div className={typeof emoji === 'string' ? 'text-4xl' : 'flex items-center justify-center'}>{emoji}</div>
      <div className="text-[15px] font-bold">{title}</div>
      {sub && <p className="max-w-[340px] text-sm text-muted">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
