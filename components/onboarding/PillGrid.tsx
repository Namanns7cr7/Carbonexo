'use client';

/**
 * PillGrid — a generic multi-select grid of pill/card buttons.
 *
 * Used by the onboarding flow to let users pick travel modes, diets,
 * electricity levels, shopping habits, and weekly goals.
 */

interface PillOption<T extends string | number> {
  /** Option value stored on selection. */
  v: T;
  /** Optional emoji prefix. */
  e?: string;
  /** Display label (falls back to `String(v)` if omitted). */
  label?: string;
  /** Short description shown below the label. */
  d?: string;
}

interface PillGridProps<T extends string | number> {
  options: PillOption<T>[];
  selected: T[];
  onToggle: (v: T) => void;
  /** Number of grid columns. Defaults to 2. */
  cols?: number;
}

export function PillGrid<T extends string | number>({
  options,
  selected,
  onToggle,
  cols = 2,
}: PillGridProps<T>) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${cols},minmax(0,1fr))` }}>
      {options.map((o) => {
        const isSelected = selected.includes(o.v);
        return (
          <button
            key={String(o.v)}
            onClick={() => onToggle(o.v)}
            aria-pressed={isSelected}
            className="relative flex items-center gap-3 rounded-[16px] border p-3.5 text-left transition-all"
            style={{
              borderColor: isSelected ? 'var(--lime)' : 'var(--border)',
              background: isSelected ? 'var(--lime-soft)' : 'var(--surface)',
              boxShadow: isSelected ? '0 10px 26px -18px var(--lime)' : 'none',
            }}
          >
            {o.e && (
              <span role="img" aria-hidden="true" className="text-2xl">
                {o.e}
              </span>
            )}
            <span className="min-w-0">
              <span
                className="block text-[15px] font-bold"
                style={{ color: isSelected ? 'var(--lime-deep)' : 'var(--text)' }}
              >
                {o.label ?? String(o.v)}
              </span>
              {o.d && <span className="block text-xs text-muted">{o.d}</span>}
            </span>
            {isSelected && (
              <span
                className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: 'var(--lime)', color: '#0c1d15' }}
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
