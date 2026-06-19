'use client';

import { motion } from 'framer-motion';
import { useCarbon } from '@/lib/store';
import { ACTIONS, CATEGORY_META, DIFFICULTY_COLOR, round1 } from '@/lib/carbon';
import { Card, PageHead, EmptyState } from '@/components/app/ui';

export default function Actions() {
  const { plan, addPlan, removePlan, togglePlan, weekTotals, profile } = useCarbon();

  const planIds = new Set(plan.map((p) => p.templateId));
  const recommended = ACTIONS.filter((a) => !planIds.has(a.id));

  const weekTotal = round1(weekTotals.reduce((s, d) => s + d.total, 0));
  const goalKg = Math.max(1, round1((weekTotal * profile.weeklyGoalPct) / 100));
  const completedSaving = round1(plan.filter((p) => p.done).reduce((s, p) => s + p.template.saving, 0));
  const goalPct = Math.min(100, Math.round((completedSaving / goalKg) * 100));
  const goalMet = completedSaving >= goalKg;

  return (
    <div className="flex flex-col gap-5">
      <PageHead eyebrow="Action plan" title="Turn insight into action" sub="Add recommendations to your plan, then check them off as you go." />

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
          <EmptyState emoji="🎯" title="Your plan is empty" sub="Add an action below to start saving CO₂." />
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

      {/* recommendations */}
      <div>
        <h2 className="mb-3 text-[15px] font-bold">Recommended for you</h2>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {recommended.map((a) => (
            <Card key={a.id} className="flex flex-col gap-3 transition-colors hover:border-lime">
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
                <button
                  onClick={() => addPlan(a.id)}
                  className="rounded-xl bg-lime px-3.5 py-2 text-xs font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5"
                >
                  + Add
                </button>
              </div>
            </Card>
          ))}
        </div>
        {recommended.length === 0 && (
          <p className="text-sm text-muted">You&apos;ve added every recommendation — nice. 🌿</p>
        )}
      </div>
    </div>
  );
}
