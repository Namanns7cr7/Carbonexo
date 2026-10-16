'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X, Minus, Plus } from 'lucide-react';
import { useCarbon } from '@/lib/store';
import { CATEGORIES, CATEGORY_META, TRACK_OPTIONS, round1, type Category, type TrackOption } from '@/lib/carbon';
import { Card, PageHead, EmptyState } from '@/components/app/ui';
import { OptionIcon } from '@/components/app/illustrations';
import { logMetaFor } from '@/lib/catalog-keys';
import { useLivingWorld } from '@/lib/living-world/LivingWorldProvider';
import { LivingEarth } from '@/components/planet/LivingEarth';
import { ProvenanceBadge } from '@/components/living-world/Provenance';

const UNIT_LABEL: Record<NonNullable<TrackOption['unit']>, string> = { km: 'km', kWh: 'kWh', item: '×' };

interface Pick {
  category: Category;
  option: TrackOption;
  qty: number;
}

const keyOf = (c: Category, o: TrackOption) => `${c}:${o.label}`;

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function Track() {
  const { todayKey, todayLogs, todayTotal, addLog, removeLog } = useCarbon();
  const { world, pulse, emitPulse } = useLivingWorld();
  const [cat, setCat] = useState<Category>('travel');

  // Deep links from the dashboard: /app/track?cat=food opens that category.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('cat');
    if (c && CATEGORIES.some((x) => x.id === c)) setCat(c as Category);
  }, []);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const options = TRACK_OPTIONS[cat];
  const isPicked = (o: TrackOption) => picks.some((p) => keyOf(p.category, p.option) === keyOf(cat, o));

  const toggle = (o: TrackOption) => {
    setPicks((prev) => {
      const k = keyOf(cat, o);
      if (prev.some((p) => keyOf(p.category, p.option) === k)) {
        return prev.filter((p) => keyOf(p.category, p.option) !== k);
      }
      return [...prev, { category: cat, option: o, qty: o.defaultQty ?? 1 }];
    });
  };

  const setQty = (k: string, qty: number) =>
    setPicks((prev) => prev.map((p) => (keyOf(p.category, p.option) === k ? { ...p, qty: Math.max(1, qty) } : p)));

  const remove = (k: string) => setPicks((prev) => prev.filter((p) => keyOf(p.category, p.option) !== k));

  const total = round1(picks.reduce((s, p) => s + p.option.factor * p.qty, 0));

  const addAll = async () => {
    if (picks.length === 0) return;
    setAdding(true);
    try {
      for (const p of picks) {
        await addLog({
          category: p.category,
          label: p.option.label,
          emoji: p.option.emoji,
          co2: round1(p.option.factor * p.qty),
          note: p.option.unit ? `${p.qty} ${UNIT_LABEL[p.option.unit]}` : undefined,
          date: todayKey,
        }, logMetaFor(p.category, p.option, p.qty));
      }
      // The planet takes a push. Its colour moves only if the day's average does.
      emitPulse('log');
      setPicks([]);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1600);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="Daily tracking" title="Log today's activity" sub="Pick a category, select everything you did, adjust amounts, then add them all." />

      {/* running total — clean card, not a heavy gradient */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-muted">Today so far</div>
            <div className="font-display text-[32px] font-extrabold">
              {todayTotal} <span className="text-base font-bold text-muted">kg CO₂</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <ProvenanceBadge provenance="logged" />
              <p className="mt-1 max-w-[190px] text-[11px] leading-snug text-muted">Your planet follows your average per logged day, not each entry.</p>
            </div>
            <div className="h-16 w-16 overflow-hidden rounded-full">
              <LivingEarth className="h-full w-full" vitality={world.visual.vitality} pulse={pulse.n} background="#06120e" label={`Your planet. ${world.visual.basis}`} />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* category tabs — keep the improved OptionIcon badges from the redesign */}
      <div role="tablist" className="flex gap-2 overflow-x-auto pb-1 cx-scroll">
        {CATEGORIES.map((c) => {
          const active = c.id === cat;
          const count = picks.filter((p) => p.category === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              role="tab"
              aria-selected={active}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5"
              style={{
                borderColor: active ? 'var(--lime)' : 'var(--border)',
                background: active ? 'var(--lime)' : 'var(--surface)',
                color: active ? '#0c1d15' : 'var(--muted)',
              }}
            >
              <span role="img" aria-hidden="true">{c.emoji}</span> {c.label}
              {count > 0 && (
                <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold"
                  style={{ background: active ? '#0c1d15' : 'var(--lime)', color: active ? 'var(--lime)' : '#0c1d15' }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* options (multi-select) — keep OptionIcon from redesign, add stagger animation */}
      <motion.div
        key={cat}
        variants={gridVariants}
        initial="hidden"
        animate="show"
        className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]"
      >
        {options.map((o) => {
          const active = isPicked(o);
          return (
            <motion.button
              key={o.label}
              variants={itemVariants}
              whileHover={{ y: -2 }}
              onClick={() => toggle(o)}
              aria-pressed={active}
              className="relative flex items-center gap-2.5 rounded-[15px] border p-3 text-left transition-colors"
              style={{
                borderColor: active ? 'var(--lime)' : 'var(--border)',
                background: active ? 'var(--lime-soft)' : 'var(--surface)',
              }}
            >
              <OptionIcon category={cat} label={o.label} color={CATEGORY_META[cat].color} size={36} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{o.label}</span>
                <span className="block text-xs text-muted">
                  {o.factor === 0 ? 'Zero emission' : `${o.factor} kg / ${o.unit ?? 'item'}`}
                </span>
              </span>
              {active && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: 'var(--lime)', color: '#0c1d15' }}>
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* selection tray */}
      <AnimatePresence>
        {picks.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <Card className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold">Selected ({picks.length})</span>
                <div className="text-right">
                  <div className="font-display text-2xl font-extrabold text-lime-deep">{total} kg</div>
                  <div className="text-xs text-muted">estimated CO₂</div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {picks.map((p) => {
                  const k = keyOf(p.category, p.option);
                  const est = round1(p.option.factor * p.qty);
                  return (
                    <div key={k} className="flex items-center gap-3 rounded-[14px] border border-border bg-surface2 px-3 py-2.5">
                      <OptionIcon category={p.category} label={p.option.label} color={CATEGORY_META[p.category].color} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold">{p.option.label}</div>
                        <div className="text-xs text-muted">{CATEGORY_META[p.category].label} · {est} kg</div>
                      </div>
                      {p.option.unit ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setQty(k, p.qty - (p.option.unit === 'km' ? 5 : 1))} aria-label="Decrease quantity" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface transition-colors hover:border-lime">
                            <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            aria-label="Quantity"
                            value={p.qty}
                            onChange={(e) => setQty(k, Number(e.target.value) || 1)}
                            className="w-12 rounded-lg border border-border bg-surface py-1.5 text-center text-sm font-bold outline-none"
                          />
                          <span className="w-7 text-xs font-semibold text-muted">{p.option.unit}</span>
                          <button onClick={() => setQty(k, p.qty + (p.option.unit === 'km' ? 5 : 1))} aria-label="Increase quantity" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface transition-colors hover:border-lime">
                            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">×1</span>
                      )}
                      <button onClick={() => remove(k)} aria-label="Remove" className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-lime hover:text-text">
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={addAll}
                disabled={adding}
                className="rounded-[14px] bg-lime py-3.5 text-[15px] font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                style={{ boxShadow: '0 12px 30px -14px var(--lime)' }}
              >
                {adding ? 'Adding…' : `Add ${picks.length} ${picks.length === 1 ? 'activity' : 'activities'} to today's log`}
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
            className="flex items-center justify-center gap-2 rounded-xl border border-lime bg-lime-soft px-4 py-3 text-center text-sm font-bold text-lime-deep"
          >
            <Check className="h-4 w-4" strokeWidth={3} /> Logged! Your footprint updated.
          </motion.div>
        )}
      </AnimatePresence>

      {/* today's entries */}
      <div>
        <h2 className="mb-3 text-[15px] font-bold">Today&apos;s log</h2>
        {todayLogs.length === 0 ? (
          <EmptyState emoji="📭" title="No entries yet" sub="Add an activity above to start tracking today." />
        ) : (
          <motion.div variants={gridVariants} initial="hidden" animate="show" className="flex flex-col gap-2">
            {todayLogs.map((l) => (
              <motion.div
                key={l.id}
                layout
                variants={itemVariants}
                className="flex items-center justify-between rounded-[14px] border border-border bg-surface px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <OptionIcon category={l.category} label={l.label} color={CATEGORY_META[l.category].color} size={32} />
                  <div>
                    <div className="text-sm font-bold">{l.label}</div>
                    {l.note && <div className="text-xs text-muted">{l.note}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-sm font-bold" style={{ color: l.co2 === 0 ? 'var(--lime-deep)' : 'var(--text)' }}>{l.co2} kg</span>
                  <button onClick={() => { emitPulse('remove'); removeLog(l.id); }} aria-label={`Remove ${l.label}`} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-lime hover:text-text">
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
