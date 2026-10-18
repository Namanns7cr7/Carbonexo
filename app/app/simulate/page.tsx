'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, TrendingDown, TrainFront, Salad, Snowflake, Wand2, PenLine, ListPlus } from 'lucide-react';
import { CATEGORIES, type Category } from '@/lib/carbon';
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
import { useLivingWorld } from '@/lib/living-world/LivingWorldProvider';
import { deriveScenarioBaseVisual } from '@/lib/living-world/derive';
import { LivingEarth } from '@/components/planet/LivingEarth';
import { ProvenanceBadge } from '@/components/living-world/Provenance';

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

  // "Can't find it?" custom activity — not in the shared catalog. The user states
  // directly how much CO2 it produces each time, instead of picking a km/kWh rate.
  const [customMode, setCustomMode] = useState(false);
  const [customCategory, setCustomCategory] = useState<Category>('travel');
  const [customLabel, setCustomLabel] = useState('');
  const [customRate, setCustomRate] = useState(1);

  // Manual entry for replacement swap
  const [customReplacementMode, setCustomReplacementMode] = useState(false);
  const [customReplacementLabel, setCustomReplacementLabel] = useState('');
  const [customReplacementRate, setCustomReplacementRate] = useState(0.4);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [scenarioLabel, setScenarioLabel] = useState('');
  const { setScenario, emitPulse } = useLivingWorld();

  // Publish the result to the shared Living World as a hypothetical. It never
  // touches the logged footprint, and it is withdrawn when you leave the page.
  useEffect(() => {
    // Only exact results reach the Living World; a range or a not-estimated change has no single number to show.
    if (!result || result.baselineCo2Kg == null || result.projectedCo2Kg == null || result.deltaCo2Kg == null) return;
    setScenario({
      label: scenarioLabel || 'this change',
      horizon: horizon,
      baselineKg: result.baselineCo2Kg,
      projectedKg: result.projectedCo2Kg,
      deltaKg: result.deltaCo2Kg,
      source: result.source ?? 'server',
    });
    emitPulse('scenario');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- publish once per result
  }, [result]);
  useEffect(() => () => setScenario(null), [setScenario]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getEmissionFactors();
        if (data && data.length > 0) {
          setFactors(data);
          setLoadError(null);
          setFactorKey(data[0].factorKey);
          setReplacementFactorKey(data[0].factorKey);
        } else {
          setLoadError('Could not load activity types. Try again shortly.');
        }
      } catch (err) {
        console.warn('Emission factors error, using defaults:', err);
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
    factorKey?: string;
    category: string;
    quantity: number;
    frequency: string;
    deltaType: SimulationDeltaType;
    replacementFactorKey?: string;
    amount?: number;
    customLabel?: string;
    customFactorKgPerUnit?: number;
    customReplacementLabel?: string;
    customReplacementFactorKgPerUnit?: number;
  }, forHorizon: SimulationHorizon) => {
    setSubmitting(true);
    setError(null);
    const from = change.customLabel ?? labelFor(change.factorKey ?? '');
    setScenarioLabel(
      change.deltaType === 'REPLACE_WITH'
        ? `${from} → ${change.customReplacementLabel ?? labelFor(change.replacementFactorKey ?? '')}`
        : `${from}, reduced by ${change.amount ?? 0}`,
    );
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

  const customValid = customMode ? customLabel.trim().length > 0 && customRate > 0 : true;
  const customReplacementValid =
    deltaType === 'REPLACE_WITH' && customReplacementMode
      ? customReplacementLabel.trim().length > 0 && customReplacementRate >= 0
      : true;
  const canSubmit = (customMode ? customValid : !!selectedFactor) && customReplacementValid;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    run(
      {
        ...(customMode
          ? { category: customCategory, customLabel: customLabel.trim(), customFactorKgPerUnit: customRate }
          : { factorKey: selectedFactor!.factorKey, category: selectedFactor!.category }),
        quantity: customMode ? 1 : quantity,
        frequency,
        deltaType,
        ...(deltaType === 'REPLACE_WITH'
          ? customReplacementMode
            ? { customReplacementLabel: customReplacementLabel.trim(), customReplacementFactorKgPerUnit: customReplacementRate }
            : { replacementFactorKey }
          : { amount: customMode ? 1 : amount }),
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
        <EmptyState emoji="" title="Couldn't load activity types" sub={loadError} />
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
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted">What do you want to change?</span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomMode((v) => !v);
                    setDeltaType('REDUCE_BY');
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-lime-deep hover:underline"
                >
                  {customMode ? (
                    <><ListPlus className="h-3 w-3" strokeWidth={2.5} /> Pick from the list instead</>
                  ) : (
                    <><PenLine className="h-3 w-3" strokeWidth={2.5} /> Can&apos;t find it? Enter it yourself</>
                  )}
                </button>
              </div>

              {customMode ? (
                <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-surface2 p-3">
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-semibold text-muted">What category is it?</span>
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value as Category)}
                      className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-semibold text-muted">Give it a name</span>
                    <input
                      type="text"
                      placeholder="e.g. Taking the office shuttle"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                      className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                    />
                  </label>
                </div>
              ) : (
                <select
                  value={factorKey}
                  onChange={(e) => setFactorKey(e.target.value)}
                  disabled={loadingFactors}
                  className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                >
                  {factors.map((f) => (
                    <option key={f.factorKey} value={f.factorKey}>
                      {f.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {!customMode && (
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
            )}

            {customMode ? (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-muted">About how much CO₂ does this produce each time? (kg)</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={customRate}
                  onChange={(e) => setCustomRate(Number(e.target.value))}
                  className="w-40 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                />
              </label>
            ) : deltaType === 'REPLACE_WITH' ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="replacement-activity" className="text-sm font-semibold text-muted">
                    Swap it for
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomReplacementMode(!customReplacementMode)}
                    className="flex items-center gap-1 text-xs font-bold transition-opacity hover:opacity-80"
                    style={{ color: 'var(--lime-deep)' }}
                  >
                    <PenLine className="h-3 w-3" />
                    {customReplacementMode ? 'Pick from common activities' : "Can't find it? Enter it yourself"}
                  </button>
                </div>

                {customReplacementMode ? (
                  <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border p-3.5" style={{ background: 'var(--surface2)' }}>
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-bold uppercase tracking-wider text-muted">Replacement activity name</span>
                      <input
                        type="text"
                        required
                        value={customReplacementLabel}
                        onChange={(e) => setCustomReplacementLabel(e.target.value)}
                        placeholder="e.g. Carpooling, Tofu stir-fry, Electric cycle"
                        className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-bold uppercase tracking-wider text-muted">About how much CO₂ does this replacement produce? (kg)</span>
                      <input
                        type="number"
                        min={0}
                        step="0.05"
                        value={customReplacementRate}
                        onChange={(e) => setCustomReplacementRate(Number(e.target.value))}
                        className="w-40 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                      />
                    </label>
                  </div>
                ) : (
                  <select
                    id="replacement-activity"
                    value={replacementFactorKey}
                    onChange={(e) => setReplacementFactorKey(e.target.value)}
                    disabled={loadingFactors}
                    className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                  >
                    {factors.map((f) => (
                      <option key={f.factorKey} value={f.factorKey}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
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
              {!customMode && (
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
              )}
              {!customMode && <span className="pb-3 text-sm text-muted">per</span>}
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-muted">{customMode ? 'How often' : ' '}</span>
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
              disabled={submitting || (!customMode && loadingFactors) || !canSubmit}
              className="self-start rounded-xl bg-lime px-5 py-2.5 text-sm font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {submitting ? 'Working it out…' : 'Show me the impact'}
            </button>
          </form>
        </Card>
      )}

      {result && result.deltaCo2Kg == null && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold">What this would mean for you</h2>
            <ProvenanceBadge provenance="hypothetical" />
          </div>
          {result.status === 'NOT_ESTIMATED' ? (
            <p role="status" className="rounded-xl border border-border bg-surface2 px-4 py-3 text-sm">
              <strong>Not estimated.</strong> We don&apos;t have a verified emission factor for part of this change in your region, so we
              won&apos;t guess a number.
            </p>
          ) : (
            <div className="rounded-xl border border-border bg-surface2 px-4 py-3">
              <div className="font-display text-xl font-extrabold" style={{ color: 'var(--lime-deep)' }}>
                {result.deltaCo2KgMin} to {result.deltaCo2KgMax} kg
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {result.status === 'PARTIAL'
                  ? 'Change from the parts we could estimate. Negative means lower emissions.'
                  : 'Range across vehicle or product types. Choose the exact type to narrow it. Negative means lower emissions.'}
              </div>
            </div>
          )}
          {result.breakdown.filter((b) => b.missingInformation).map((b) => (
            <p key={b.factorKey} className="text-xs text-muted">
              {labelFor(b.factorKey)}: needs {b.missingInformation}.
            </p>
          ))}
          <FactorNote result={result} />
        </Card>
        </motion.div>
      )}

      {result && result.deltaCo2Kg != null && result.baselineCo2Kg != null && result.projectedCo2Kg != null && (() => {
        const delta = result.deltaCo2Kg;
        const baseline = result.baselineCo2Kg;
        const improving = delta <= 0;
        const pctChange = baseline > 0 ? Math.round((delta / baseline) * 100) : 0;
        const gaugeFraction = Math.min(1, Math.abs(pctChange) / 100);
        const gaugeColor = improving ? 'var(--lime)' : '#e0a86a';
        const gaugeTextColor = improving ? 'var(--lime-deep)' : '#e0a86a';
        return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold">What this would mean for you</h2>
            <ProvenanceBadge provenance="hypothetical" />
          </div>
          <FactorNote result={result} />

          <ScenarioWorld />

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
                  style={{ color: delta <= 0 ? 'var(--lime-deep)' : '#e0a86a' }}
                >
                  {delta > 0 ? '+' : ''}{delta} kg
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-muted">{improving ? 'Would be lower by' : 'Would be higher by'}</div>
              </Card>
            </div>
          </div>

          {result.weeklyGoalImpact.projectedProgressPct === 0 && result.weeklyGoalImpact.currentProgressPct === 0 && (
            <p className="text-xs text-muted">Weekly goal impact appears once you have a week of logs to set a target against.</p>
          )}
          {(result.weeklyGoalImpact.projectedProgressPct > 0 || result.weeklyGoalImpact.currentProgressPct > 0) && (
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
          )}

          <p className="rounded-xl border border-border bg-surface2 px-4 py-3 text-xs leading-relaxed text-muted">
            A simulation changes nothing: no activity is logged and no Green Points are awarded. Make the change for real, then log it — or add the matching action to your plan.
          </p>

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
                  <span className="font-semibold">
                    {b.baselineKg} kg → {b.projectedKg} kg{b.factorSource === 'user_supplied' ? ' (your rate)' : ''}
                  </span>
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

/** Which factor dataset produced the numbers, and whether a person has reviewed it yet. */
function FactorNote({ result }: { result: SimulationResult }) {
  if (!result.factorAuthority || result.factorAuthority === 'APPROVED') return null;
  return (
    <p className="text-[11px] text-muted">
      {result.factorAuthority === 'CANDIDATE'
        ? `Provisional factors (dataset ${result.factorDatasetVersion}), not yet reviewed by a person.`
        : 'No reviewed emission-factor dataset is active yet, so changes are not estimated.'}
    </p>
  );
}

/**
 * One planet, two states. Drag the slider (or tap a side) and the same globe
 * eases between the world your logs describe and the hypothetical one. Using a
 * single renderer keeps one GL context and makes the comparison physical.
 */
function ScenarioWorld() {
  const { world } = useLivingWorld();
  const [t, setT] = useState(1);
  const now = deriveScenarioBaseVisual(world.actual);
  const what = world.scenarioVisual;
  if (!what) return null;
  const vitality = now.vitality + (what.vitality - now.vitality) * t;
  const showing = t >= 0.5 ? what : now;
  return (
    <div className="grid items-center gap-4 rounded-2xl border border-border p-4 sm:grid-cols-[200px_minmax(0,1fr)]" style={{ background: 'radial-gradient(120% 90% at 30% 0%, rgba(16,48,36,0.5), var(--card) 70%)' }}>
      <div className="mx-auto h-[180px] w-[180px] overflow-hidden rounded-full">
        <LivingEarth className="h-full w-full" vitality={vitality} interactive background="#06120e" label={`Comparison planet. ${showing.basis}`} />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ProvenanceBadge provenance={showing.provenance} />
          <span className="text-xs font-semibold text-text">{showing.caption}</span>
        </div>
        <label className="flex flex-col gap-1.5 text-xs font-bold text-muted">
          <span className="flex justify-between">
            <span>Now</span>
            <span>With this change</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            aria-label="Compare your planet now with the hypothetical planet"
            aria-valuetext={t >= 0.5 ? 'With this change (hypothetical)' : 'Now'}
            className="w-full accent-[var(--lime)]"
          />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setT(0)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold" aria-pressed={t < 0.5}>
            Now
          </button>
          <button type="button" onClick={() => setT(1)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold" aria-pressed={t >= 0.5}>
            With this change
          </button>
        </div>
        <p className="text-[11.5px] leading-relaxed text-muted">{showing.basis}</p>
      </div>
    </div>
  );
}
