'use client';

/**
 * "Add your own" — log something the Track catalog doesn't have.
 *
 * The user names it, picks a unit, and sets kg CO₂e per unit — either typed
 * or copied from a similar catalog item ("Similar to: Veg meal"), which is
 * the easy, honest way to estimate. The result joins the normal selection,
 * so it's logged through exactly the same path as every other activity.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { CATEGORIES, CATEGORY_META, TRACK_OPTIONS, type Category } from '@/lib/carbon';
import { DEFAULT_UNIT, MAX_NAME, estimateKg, validateDraft, type CustomDraft, type CustomUnit } from '@/lib/custom-items';
import { ProvenanceBadge } from '@/components/living-world/Provenance';
import { UI_SPRING } from '@/components/physics';

const UNITS: { id: CustomUnit; label: string; hint: string }[] = [
  { id: 'item', label: 'per item', hint: 'a meal, a product, a bag' },
  { id: 'km', label: 'per km', hint: 'a trip' },
  { id: 'kWh', label: 'per kWh', hint: 'an appliance' },
];

const PLACEHOLDER: Record<Category, string> = {
  travel: 'e.g. Ferry, Auto-rickshaw, E-scooter',
  food: 'e.g. Paneer tikka, Homemade dal, Pizza',
  electricity: 'e.g. Water pump, Gaming PC, Oven',
  shopping: 'e.g. Sneakers, Phone case, Furniture',
  waste: 'e.g. E-waste, Glass jar, Cardboard box',
};

export function CustomItemSheet({
  open,
  initialCategory,
  onClose,
  onAdd,
}: {
  open: boolean;
  initialCategory: Category;
  onClose: () => void;
  onAdd: (draft: CustomDraft, remember: boolean) => void;
}) {
  const [d, setD] = useState<CustomDraft>(() => blank(initialCategory));
  const [remember, setRemember] = useState(true);
  const [touched, setTouched] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  // Fresh form each time it opens, in the category the user was looking at.
  useEffect(() => {
    if (!open) return;
    setD(blank(initialCategory));
    setTouched(false);
    const t = window.setTimeout(() => nameRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, initialCategory, onClose]);

  const set = (p: Partial<CustomDraft>) => setD((x) => ({ ...x, ...p }));
  const errors = validateDraft(d);
  const valid = Object.keys(errors).length === 0;
  const kg = estimateKg(d);

  // Catalog items to copy a rate from: same category, matching unit first.
  const similar = useMemo(
    () => [...TRACK_OPTIONS[d.category]].sort((a, b) => Number((b.unit ?? 'item') === d.unit) - Number((a.unit ?? 'item') === d.unit)),
    [d.category, d.unit],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    onAdd(d, remember);
  };

  const base = 'rounded-xl border border-border bg-surface2 px-3.5 py-2.5 text-sm font-semibold outline-none transition-colors focus:border-lime/60';
  const field = `w-full ${base}`;
  const err = (k: keyof typeof errors) => touched && errors[k] && <span className="text-[11px] font-semibold text-danger">{errors[k]}</span>;

  // Portalled to <body>: inside the app shell's stacking context the sheet
  // would sit under the mobile bottom nav.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden />
          <motion.form
            onSubmit={submit}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative max-h-[92svh] w-full overflow-y-auto rounded-t-[26px] border border-border p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-[520px] sm:rounded-[24px] sm:pb-5 cx-scroll"
            style={{ background: 'var(--navbg)', backdropFilter: 'blur(20px) saturate(180%)' }}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', ...UI_SPRING }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id={titleId} className="font-display text-[20px] font-extrabold tracking-[-0.02em]">
                  Add your own
                </h2>
                <p className="text-[13px] text-muted">Not in the list? Describe it and estimate its footprint.</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-muted hover:bg-surface2 hover:text-text">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Category */}
              <fieldset>
                <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Category</legend>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => {
                    const on = c.id === d.category;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set({ category: c.id, unit: DEFAULT_UNIT[c.id], basedOn: undefined })}
                        className="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors"
                        style={{ borderColor: on ? 'var(--lime)' : 'var(--border)', background: on ? 'var(--lime)' : 'var(--surface)', color: on ? '#0c1d15' : 'var(--muted)' }}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Name */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Name</span>
                <input ref={nameRef} value={d.label} maxLength={MAX_NAME} onChange={(e) => set({ label: e.target.value })} placeholder={PLACEHOLDER[d.category]} className={field} />
                {err('label')}
              </label>

              {/* Unit */}
              <fieldset>
                <legend className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">Measured</legend>
                <div className="grid grid-cols-3 gap-1.5">
                  {UNITS.map((u) => {
                    const on = u.id === d.unit;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set({ unit: u.id, basedOn: undefined })}
                        className="rounded-xl border px-2 py-2 text-center transition-colors"
                        style={{ borderColor: on ? 'var(--lime)' : 'var(--border)', background: on ? 'var(--lime-soft)' : 'var(--surface)' }}
                      >
                        <span className="block text-xs font-bold">{u.label}</span>
                        <span className="block text-[10px] text-muted">{u.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Rate — with "similar to" shortcuts */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Footprint estimate</span>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Copy the rate of a similar item">
                  <span className="self-center text-[11px] font-semibold text-muted">Similar to:</span>
                  {similar.slice(0, 6).map((o) => {
                    const on = d.basedOn === o.label;
                    return (
                      <button
                        key={o.label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set({ factor: o.factor, unit: o.unit ?? 'item', basedOn: o.label })}
                        className="rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors hover:border-lime"
                        style={{ borderColor: on ? 'var(--lime)' : 'var(--border)', background: on ? 'var(--lime-soft)' : 'transparent', color: on ? 'var(--lime-deep)' : 'var(--text)' }}
                      >
                        {o.label} <span className="font-mono font-normal text-muted">{o.factor}/{o.unit ?? 'item'}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    aria-label={`kg CO₂e per ${d.unit}`}
                    value={Number.isFinite(d.factor) ? d.factor : ''}
                    onChange={(e) => set({ factor: e.target.value === '' ? NaN : Number(e.target.value), basedOn: undefined })}
                    className={`${base} w-28 flex-shrink-0 font-mono`}
                  />
                  <span className="text-sm font-semibold text-muted">kg CO₂e per {d.unit}</span>
                </div>
                {err('factor')}
                <p className="text-[11px] leading-relaxed text-muted">
                  Not sure? Pick the closest item above — it copies the same factor Carbonexo uses for it. {d.basedOn && <strong className="text-text">Using “{d.basedOn}”.</strong>}
                </p>
              </div>

              {/* Amount */}
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">How much today</span>
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="decimal" min={0} step="any" value={Number.isFinite(d.qty) ? d.qty : ''} onChange={(e) => set({ qty: e.target.value === '' ? NaN : Number(e.target.value) })} className={`${base} w-28 flex-shrink-0 font-mono`} />
                  <span className="text-sm font-semibold text-muted">{d.unit === 'item' ? 'item(s)' : d.unit}</span>
                </div>
                {err('qty')}
              </label>

              {/* Preview */}
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface2 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_META[d.category].color }} />
                  <div>
                    <div className="text-sm font-bold">{d.label.trim() || 'Your item'}</div>
                    <ProvenanceBadge provenance="estimate" className="mt-0.5" />
                  </div>
                </div>
                <motion.div key={kg} initial={{ scale: 0.92, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', ...UI_SPRING }} className="text-right">
                  <div className="font-display text-2xl font-extrabold text-lime-deep">{kg} kg</div>
                  <div className="text-[11px] text-muted">CO₂e, your estimate</div>
                </motion.div>
              </div>

              <label className="flex items-center gap-2.5 text-sm font-semibold">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[var(--lime)]" />
                Save to <span className="text-lime-deep">My items</span> for one-tap logging
                <span className="text-[11px] font-normal text-muted">(this device)</span>
              </label>

              <div className="flex gap-2.5">
                <button type="button" onClick={onClose} className="rounded-[14px] border border-border bg-surface px-5 py-3 text-sm font-bold text-text hover:border-lime">
                  Cancel
                </button>
                <button type="submit" disabled={touched && !valid} className="flex-1 rounded-[14px] bg-lime px-5 py-3 text-sm font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5 disabled:opacity-50" style={{ boxShadow: '0 12px 30px -14px var(--lime)' }}>
                  Add to selection
                </button>
              </div>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function blank(category: Category): CustomDraft {
  return { category, label: '', factor: NaN, unit: DEFAULT_UNIT[category], qty: 1, basedOn: undefined };
}
