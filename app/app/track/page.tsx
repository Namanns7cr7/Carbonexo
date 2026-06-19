'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCarbon } from '@/lib/store';
import { CATEGORIES, TRACK_OPTIONS, round1, type Category, type TrackOption } from '@/lib/carbon';
import { Card, PageHead, EmptyState } from '@/components/app/ui';

const UNIT_LABEL: Record<NonNullable<TrackOption['unit']>, string> = { km: 'km', kWh: 'kWh', item: '×' };

export default function Track() {
  const { todayKey, todayLogs, todayTotal, addLog, removeLog } = useCarbon();
  const [cat, setCat] = useState<Category>('travel');
  const [selected, setSelected] = useState<TrackOption | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [justAdded, setJustAdded] = useState(false);

  const options = TRACK_OPTIONS[cat];
  const estimate = selected ? round1(selected.factor * qty) : 0;

  const pick = (o: TrackOption) => {
    setSelected(o);
    setQty(o.defaultQty ?? 1);
  };

  const add = () => {
    if (!selected) return;
    addLog({
      category: cat,
      label: selected.label,
      emoji: selected.emoji,
      co2: estimate,
      note: selected.unit ? `${qty} ${UNIT_LABEL[selected.unit]}` : undefined,
      date: todayKey,
    });
    setSelected(null);
    setQty(1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="Daily tracking" title="Log today's activity" sub="Pick a category, choose what you did, and we'll estimate the CO₂." />

      {/* running total */}
      <Card className="flex items-center justify-between !bg-lime-soft">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-lime-deep">Today so far</div>
          <div className="font-display text-[28px] font-extrabold">{todayTotal} <span className="text-base font-bold text-muted">kg CO₂</span></div>
        </div>
        <div className="text-4xl">🌍</div>
      </Card>

      {/* category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 cx-scroll">
        {CATEGORIES.map((c) => {
          const active = c.id === cat;
          return (
            <button
              key={c.id}
              onClick={() => { setCat(c.id); setSelected(null); }}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                borderColor: active ? 'var(--lime)' : 'var(--border)',
                background: active ? 'var(--lime)' : 'var(--surface)',
                color: active ? '#0c1d15' : 'var(--muted)',
              }}
            >
              <span>{c.emoji}</span> {c.label}
            </button>
          );
        })}
      </div>

      {/* options */}
      <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
        {options.map((o) => {
          const active = selected?.label === o.label;
          return (
            <button
              key={o.label}
              onClick={() => pick(o)}
              className="flex items-center gap-2.5 rounded-[15px] border p-3 text-left transition-all"
              style={{
                borderColor: active ? 'var(--lime)' : 'var(--border)',
                background: active ? 'var(--lime-soft)' : 'var(--surface)',
              }}
            >
              <span className="text-2xl">{o.emoji}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{o.label}</span>
                <span className="block text-xs text-muted">
                  {o.factor === 0 ? 'Zero emission' : `${o.factor} kg / ${o.unit ?? 'item'}`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* quantity + add */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <Card className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{selected.emoji}</span>
                  <span className="text-[15px] font-bold">{selected.label}</span>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl font-extrabold text-lime-deep">{estimate} kg</div>
                  <div className="text-xs text-muted">estimated CO₂</div>
                </div>
              </div>

              {selected.unit && (
                <div className="flex items-center gap-3">
                  <button onClick={() => setQty((q) => Math.max(selected.unit === 'item' ? 1 : 1, q - (selected.unit === 'km' ? 5 : 1)))} className="h-10 w-10 rounded-xl border border-border bg-surface text-lg font-bold">−</button>
                  <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface2 py-2.5">
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 bg-transparent text-center text-lg font-bold outline-none"
                    />
                    <span className="text-sm font-semibold text-muted">{selected.unit}</span>
                  </div>
                  <button onClick={() => setQty((q) => q + (selected.unit === 'km' ? 5 : 1))} className="h-10 w-10 rounded-xl border border-border bg-surface text-lg font-bold">+</button>
                </div>
              )}

              <button
                onClick={add}
                className="rounded-[14px] bg-lime py-3.5 text-[15px] font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5"
                style={{ boxShadow: '0 12px 30px -14px var(--lime)' }}
              >
                Add to today&apos;s log
              </button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {justAdded && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-lime bg-lime-soft px-4 py-3 text-center text-sm font-bold text-lime-deep"
          >
            ✓ Logged! Your footprint updated.
          </motion.div>
        )}
      </AnimatePresence>

      {/* today's entries */}
      <div>
        <h2 className="mb-3 text-[15px] font-bold">Today&apos;s log</h2>
        {todayLogs.length === 0 ? (
          <EmptyState emoji="📭" title="No entries yet" sub="Add an activity above to start tracking today." />
        ) : (
          <div className="flex flex-col gap-2">
            {todayLogs.map((l) => (
              <motion.div
                key={l.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between rounded-[14px] border border-border bg-surface px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{l.emoji}</span>
                  <div>
                    <div className="text-sm font-bold">{l.label}</div>
                    {l.note && <div className="text-xs text-muted">{l.note}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-sm font-bold" style={{ color: l.co2 === 0 ? 'var(--lime-deep)' : 'var(--text)' }}>{l.co2} kg</span>
                  <button onClick={() => removeLog(l.id)} aria-label="Remove" className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-lime hover:text-text">
                    ✕
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
