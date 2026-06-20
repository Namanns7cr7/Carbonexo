'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCarbon } from '@/lib/store';
import { ACTIONS, CATEGORY_META, DIFFICULTY_COLOR, round1 } from '@/lib/carbon';
import { Card, PageHead, EmptyState } from '@/components/app/ui';

export default function Actions() {
  const { plan, addPlan, removePlan, togglePlan, weekTotals, profile } = useCarbon();
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const planIds = new Set(plan.map((p) => p.templateId));
  const recommended = ACTIONS.filter((a) => !planIds.has(a.id));

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const addSelected = () => {
    picked.forEach((id) => addPlan(id));
    setPicked(new Set());
  };

  const pickedSaving = round1(
    ACTIONS.filter((a) => picked.has(a.id)).reduce((s, a) => s + a.saving, 0),
  );

  const weekTotal = round1(weekTotals.reduce((s, d) => s + d.total, 0));
  const goalKg = Math.max(1, round1((weekTotal * profile.weeklyGoalPct) / 100));
  const completedSaving = round1(plan.filter((p) => p.done).reduce((s, p) => s + p.template.saving, 0));
  const goalPct = Math.min(100, Math.round((completedSaving / goalKg) * 100));
  const goalMet = completedSaving >= goalKg;

  return (
    <div className="flex flex-col gap-5 pb-24">
      <PageHead eyebrow="Action plan" title="Turn insight into action" sub="Select the recommendations you want, add them to your plan, then check them off." />

      {/* weekly goal */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Weekly goal</h2>
          <span className="text-xs font-semibold text-muted">{completedSaving} / {goalKg} kg saved</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface2">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg,var(--lime),var(--blue))' }}
            initial={{ width: 0 }}
            animate={{ width: `${goalPct}%` }}
            transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          />
        </div>
        <p className="mt-2.5 text-sm text-muted">
          {goalMet ? (
            <span className="font-bold text-lime-deep">🎉 Goal reached — you&apos;re cutting more than your weekly target!</span>
          ) : (
            <>Targeting a <strong className="text-text">{profile.weeklyGoalPct}%</strong> cut. Complete actions to fill the bar.</>
          )}
        </p>
      </Card>

      {/* my plan */}
      <div>
        <h2 className="mb-3 text-[15px] font-bold">My plan {plan.length > 0 && <span className="text-muted">({plan.filter((p) => p.done).length}/{plan.length})</span>}</h2>
        {plan.length === 0 ? (
          <EmptyState emoji="🎯" title="Your plan is empty" sub="Select actions below to start saving CO₂." />
        ) : (
          <div className="flex flex-col gap-2">
            {plan.map((p) => (
              <motion.div key={p.templateId} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3">
                <button
                  onClick={() => togglePlan(p.templateId)}
                  aria-label={p.done ? 'Mark not done' : 'Mark done'}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold transition-colors"
                  style={{
                    borderColor: p.done ? 'var(--lime)' : 'var(--border)',
                    background: p.done ? 'var(--lime)' : 'transparent',
                    color: p.done ? '#0c1d15' : 'transparent',
                  }}
                >
                  ✓
                </button>
                <span className="text-xl">{p.template.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-bold ${p.done ? 'text-muted line-through' : ''}`}>{p.template.title}</div>
                  <div className="text-xs text-muted">Saves ~{p.template.saving} kg / week</div>
                </div>
                <button onClick={() => removePlan(p.templateId)} aria-label="Remove" className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-lime hover:text-text">✕</button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* recommendations (multi-select) */}
      <div>
        <h2 className="mb-3 text-[15px] font-bold">Recommended for you</h2>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {recommended.map((a) => {
            const sel = picked.has(a.id);
            return (
              <button
                key={a.id}
                onClick={() => togglePick(a.id)}
                className="relative flex flex-col gap-3 rounded-[18px] border p-4 text-left transition-all"
                style={{
                  borderColor: sel ? 'var(--lime)' : 'var(--border)',
                  background: sel ? 'var(--lime-soft)' : 'var(--surface)',
                  boxShadow: sel ? '0 12px 30px -18px var(--lime)' : 'none',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] text-2xl" style={{ background: 'var(--lime-soft)' }}>{a.emoji}</div>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: 'var(--lime)', color: '#0c1d15' }}>−{a.saving} kg/wk</span>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold leading-snug">{a.title}</h3>
                  <p className="mt-1 text-[13px] leading-[1.5] text-muted">{a.desc}</p>
                </div>
                <div className="mt-auto flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full px-2 py-0.5" style={{ background: 'var(--surface2)', color: DIFFICULTY_COLOR[a.difficulty] }}>{a.difficulty}</span>
                    <span className="text-muted">{CATEGORY_META[a.category].label}</span>
                  </div>
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-[12px] font-bold transition-colors"
                    style={{
                      borderColor: sel ? 'var(--lime)' : 'var(--border)',
                      background: sel ? 'var(--lime)' : 'transparent',
                      color: sel ? '#0c1d15' : 'transparent',
                    }}
                  >
                    ✓
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {recommended.length === 0 && (
          <p className="text-sm text-muted">You&apos;ve added every recommendation — nice. 🌿</p>
        )}
      </div>

      {/* bulk add bar */}
      <AnimatePresence>
        {picked.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-0 z-20 px-5 pb-5 md:pl-[268px]"
          >
            <div className="mx-auto flex max-w-[840px] items-center justify-between gap-4 rounded-[16px] border border-lime bg-surface px-4 py-3 shadow-lg">
              <span className="text-sm font-bold">
                {picked.size} selected <span className="font-semibold text-muted">· saves ~{pickedSaving} kg/wk</span>
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPicked(new Set())} className="rounded-xl border border-border px-3.5 py-2 text-xs font-bold text-muted transition-colors hover:text-text">Clear</button>
                <button onClick={addSelected} className="rounded-xl bg-lime px-4 py-2 text-xs font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5">
                  Add {picked.size} to my plan
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
