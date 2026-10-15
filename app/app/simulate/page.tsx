'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, TrendingDown, TrainFront, Salad, Snowflake, Wand2 } from 'lucide-react';
import { getEmissionFactors, type EmissionFactorData } from '@/lib/api/dashboard';
import {
  runSimulation,
  type SimulationDeltaType,
  type SimulationHorizon,
  type SimulationResult,
} from '@/lib/api/simulations';
import { ApiError } from '@/lib/api/client';
import { Card, PageHead, EmptyState, SegmentedControl } from '@/components/app/ui';
import { ImpactGauge } from '@/components/app/charts';

const FREQUENCIES: { value: string; label: string }[] = [
  { value: 'per_day', label: 'day' },
  { value: 'per_week', label: 'week' },
  { value: 'per_month', label: 'month' },
];

/** Ready-made, plain-language scenarios so a non-technical user can get a result in
 * one tap instead of having to understand the custom-builder's fields first. Each
 * is only shown if its factor keys actually exist in the loaded catalog. */
const QUICK_SCENARIOS = [
  {
    id: 'metro',
    title: 'Drive less, take the metro',
    desc: 'Swap some car rides for the metro each week.',
    icon: TrainFront,
    color: 'var(--lime)',
    factorKey: 'car_ride',
    replacementFactorKey: 'metro_train',
    quantity: 10,
    frequency: 'per_week',
    deltaType: 'REPLACE_WITH' as SimulationDeltaType,
  },
  {
    id: 'meat',
    title: 'Eat a bit less meat',
    desc: 'Swap a few beef meals for veg meals each week.',
    icon: Salad,
    color: 'var(--blue)',
    factorKey: 'beef_meal',
    replacementFactorKey: 'veg_meal',
    quantity: 3,
    frequency: 'per_week',
    deltaType: 'REPLACE_WITH' as SimulationDeltaType,
  },
  {
    id: 'ac',
    title: 'Run the AC a little less',
    desc: 'Cut back your air conditioning hours each week.',
    icon: Snowflake,
    color: '#8fc9a0',
    factorKey: 'air_conditioning',
    quantity: 14,
    frequency: 'per_week',
    deltaType: 'REDUCE_BY' as SimulationDeltaType,
    amount: 6,
  },
];

export default function Simulate() {
  const [factors, setFactors] = useState<EmissionFactorData[]>([]);
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [factorKey, setFactorKey] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [frequency, setFrequency] = useState('per_week');
  const [deltaType, setDeltaType] = useState<SimulationDeltaType>('REPLACE_WITH');
  const [replacementFactorKey, setReplacementFactorKey] = useState('');
  const [amount, setAmount] = useState(5);
  const [horizon, setHorizon] = useState<SimulationHorizon>('MONTH');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getEmissionFactors();
        setFactors(data);
        if (data.length > 0) {
          setFactorKey(data[0].factorKey);
          setReplacementFactorKey(data[0].factorKey);
        }
      } catch {
        setLoadError('Could not load activity types. Try again shortly.');
      } finally {
        setLoadingFactors(false);
      }
    })();
  }, []);

  const selectedFactor = useMemo(
    () => factors.find((f) => f.factorKey === factorKey) ?? null,
    [factors, factorKey],
  );
  const labelFor = (key: string) => factors.find((f) => f.factorKey === key)?.label ?? key;

  const run = async (change: {
    factorKey: string;
    category: string;
    quantity: number;
    frequency: string;
    deltaType: SimulationDeltaType;
    replacementFactorKey?: string;
    amount?: number;
  }, forHorizon: SimulationHorizon) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await runSimulation({ horizon: forHorizon, changes: [change] });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not run the simulation. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const runQuickScenario = (s: (typeof QUICK_SCENARIOS)[number]) => {
    const factor = factors.find((f) => f.factorKey === s.factorKey);
    if (!factor) return;
    setFactorKey(s.factorKey);
    setQuantity(s.quantity);
    setFrequency(s.frequency);
    setDeltaType(s.deltaType);
    if (s.replacementFactorKey) setReplacementFactorKey(s.replacementFactorKey);
    if (s.amount) setAmount(s.amount);
    run(
      {
        factorKey: s.factorKey,
        category: factor.category,
        quantity: s.quantity,
        frequency: s.frequency,
        deltaType: s.deltaType,
        ...(s.deltaType === 'REPLACE_WITH' ? { replacementFactorKey: s.replacementFactorKey } : { amount: s.amount }),
      },
      horizon,
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFactor) return;
    run(
      {
        factorKey: selectedFactor.factorKey,
        category: selectedFactor.category,
        quantity,
        frequency,
        deltaType,
        ...(deltaType === 'REPLACE_WITH' ? { replacementFactorKey } : { amount }),
      },
      horizon,
    );
  };

  const availableScenarios = QUICK_SCENARIOS.filter(
    (s) => factors.some((f) => f.factorKey === s.factorKey) && (!s.replacementFactorKey || factors.some((f) => f.factorKey === s.replacementFactorKey)),
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        eyebrow="Carbon twin"
        title="Try a change before you make it"
        sub="Pick something small you could do differently — like taking the metro instead of driving — and see what it would actually save, in plain numbers."
      />

      {loadError && (
        <EmptyState emoji="⚠️" title="Couldn't load activity types" sub={loadError} />
      )}

      {!loadError && !loadingFactors && availableScenarios.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-sm font-bold">
            <Wand2 className="h-4 w-4" style={{ color: 'var(--lime)' }} strokeWidth={2} />
            Try one of these
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {availableScenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => runQuickScenario(s)}
                disabled={submitting}
                className="flex flex-col items-start gap-2 rounded-[15px] border border-border bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-lime disabled:opacity-50"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: `color-mix(in srgb, ${s.color} 18%, transparent)` }}
                >
                  <s.icon style={{ width: 18, height: 18, color: s.color }} strokeWidth={2} />
                </span>
                <span className="text-sm font-bold">{s.title}</span>
                <span className="text-xs text-muted">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!loadError && (
        <Card as="section">
          <div className="mb-1 text-sm font-bold">Or build your own</div>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-muted">What do you want to change?</span>
              <select
                value={factorKey}
                onChange={(e) => setFactorKey(e.target.value)}
                disabled={loadingFactors}
                className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
              >
                {factors.map((f) => (
                  <option key={f.factorKey} value={f.factorKey}>
                    {f.emoji} {f.label}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-muted">How do you want to change it?</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeltaType('REPLACE_WITH')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors"
                  style={{
                    borderColor: deltaType === 'REPLACE_WITH' ? 'var(--lime)' : 'var(--border)',
                    background: deltaType === 'REPLACE_WITH' ? 'var(--lime-soft)' : 'var(--surface)',
                  }}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2.5} /> Swap it for something else
                </button>
                <button
                  type="button"
                  onClick={() => setDeltaType('REDUCE_BY')}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors"
                  style={{
                    borderColor: deltaType === 'REDUCE_BY' ? 'var(--lime)' : 'var(--border)',
                    background: deltaType === 'REDUCE_BY' ? 'var(--lime-soft)' : 'var(--surface)',
                  }}
                >
                  <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.5} /> Just do less of it
                </button>
              </div>
            </div>

            {deltaType === 'REPLACE_WITH' ? (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-muted">Swap it for</span>
                <select
                  value={replacementFactorKey}
                  onChange={(e) => setReplacementFactorKey(e.target.value)}
                  disabled={loadingFactors}
                  className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                >
                  {factors.map((f) => (
                    <option key={f.factorKey} value={f.factorKey}>
                      {f.emoji} {f.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-muted">
                  Cut it down by {selectedFactor ? `(${selectedFactor.unit})` : ''}
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                />
              </label>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-muted">How much{selectedFactor ? ` (${selectedFactor.unit})` : ''}</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-28 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                />
              </label>
              <span className="pb-3 text-sm text-muted">per</span>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-muted">&nbsp;</span>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold text-muted">See the impact over</span>
              <SegmentedControl
                options={[{ id: 'MONTH', label: '1 month' }, { id: 'YEAR', label: '1 year' }]}
                value={horizon}
                onChange={setHorizon}
              />
            </label>

            {error && <p className="text-sm font-semibold text-danger">{error}</p>}

            <button
              type="submit"
              disabled={submitting || loadingFactors || !selectedFactor}
              className="self-start rounded-xl bg-lime px-5 py-2.5 text-sm font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {submitting ? 'Working it out…' : 'Show me the impact'}
            </button>
          </form>
        </Card>
      )}

      {result && (() => {
        const improving = result.deltaCo2Kg <= 0;
        const pctChange = result.baselineCo2Kg > 0 ? Math.round((result.deltaCo2Kg / result.baselineCo2Kg) * 100) : 0;
        const gaugeFraction = Math.min(1, Math.abs(pctChange) / 100);
        const gaugeColor = improving ? 'var(--lime)' : '#e0a86a';
        const gaugeTextColor = improving ? 'var(--lime-deep)' : '#e0a86a';
        return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="flex flex-col gap-4">
          <h2 className="text-[15px] font-bold">What this would mean for you</h2>

          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ImpactGauge
              value={`${pctChange > 0 ? '+' : ''}${pctChange}%`}
              unit={improving ? 'lower CO₂' : 'higher CO₂'}
              fraction={gaugeFraction}
              size={130}
              color={gaugeColor}
              textColor={gaugeTextColor}
            />
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3">
              <Card className="!p-4 text-center">
                <div className="font-display text-xl font-extrabold">{result.baselineCo2Kg} kg</div>
                <div className="mt-0.5 text-[11px] font-semibold text-muted">If nothing changes</div>
              </Card>
              <Card className="!p-4 text-center">
                <div className="font-display text-xl font-extrabold" style={{ color: 'var(--lime-deep)' }}>
                  {result.projectedCo2Kg} kg
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-muted">If you make this change</div>
              </Card>
              <Card className="!p-4 text-center">
                <div
                  className="font-display text-xl font-extrabold"
                  style={{ color: result.deltaCo2Kg <= 0 ? 'var(--lime-deep)' : '#e0a86a' }}
                >
                  {result.deltaCo2Kg > 0 ? '+' : ''}{result.deltaCo2Kg} kg
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-muted">{improving ? 'You’d save' : 'Extra'}</div>
              </Card>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold">How close this gets you to your weekly goal</span>
              <span className="text-xs font-semibold text-muted">
                {result.weeklyGoalImpact.currentProgressPct}% → {result.weeklyGoalImpact.projectedProgressPct}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, result.weeklyGoalImpact.projectedProgressPct)}%`,
                  background: 'linear-gradient(90deg,var(--lime),var(--blue))',
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-4 py-3">
            <span className="text-sm font-semibold text-muted">Credits you&apos;d earn for this</span>
            <span className="font-display text-lg font-extrabold">+{result.projectedCreditsDelta}</span>
          </div>

          {result.aiInsight && (
            <div className="rounded-xl border border-border bg-lime-soft px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-lime-deep">In short</div>
              <p className="mt-1 text-sm">{result.aiInsight}</p>
            </div>
          )}

          {result.breakdown.length > 0 && (
            <div className="flex flex-col divide-y divide-border">
              {result.breakdown.map((b) => (
                <div key={b.factorKey} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted">{labelFor(b.factorKey)}</span>
                  <span className="font-semibold">{b.baselineKg} kg → {b.projectedKg} kg</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        </motion.div>
        );
      })()}
    </div>
  );
}
