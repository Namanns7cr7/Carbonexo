'use client';

import { useEffect, useMemo, useState } from 'react';
import { getEmissionFactors, type EmissionFactorData } from '@/lib/api/dashboard';
import {
  runSimulation,
  type SimulationDeltaType,
  type SimulationHorizon,
  type SimulationResult,
} from '@/lib/api/simulations';
import { ApiError } from '@/lib/api/client';
import { Card, PageHead, EmptyState } from '@/components/app/ui';

const FREQUENCIES: { value: string; label: string }[] = [
  { value: 'per_day', label: 'Per day' },
  { value: 'per_week', label: 'Per week' },
  { value: 'per_month', label: 'Per month' },
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFactor) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await runSimulation({
        horizon,
        changes: [
          {
            factorKey: selectedFactor.factorKey,
            category: selectedFactor.category,
            quantity,
            frequency,
            deltaType,
            ...(deltaType === 'REPLACE_WITH' ? { replacementFactorKey } : { amount }),
          },
        ],
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not run the simulation. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        eyebrow="Carbon twin"
        title="Simulate a habit change"
        sub="Try a hypothetical swap or cutback and see what it would do to your footprint, your weekly goal, and your credits — before you commit to it."
      />

      {loadError && (
        <EmptyState emoji="⚠️" title="Couldn't load activity types" sub={loadError} />
      )}

      {!loadError && (
        <Card as="section">
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-muted">Current activity</span>
                <select
                  value={factorKey}
                  onChange={(e) => setFactorKey(e.target.value)}
                  disabled={loadingFactors}
                  className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                >
                  {factors.map((f) => (
                    <option key={f.factorKey} value={f.factorKey}>
                      {f.emoji} {f.label} ({f.factorKgPerUnit} kg/{f.unit})
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-muted">Horizon</span>
                <select
                  value={horizon}
                  onChange={(e) => setHorizon(e.target.value as SimulationHorizon)}
                  className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                >
                  <option value="MONTH">Next month</option>
                  <option value="YEAR">Next year</option>
                </select>
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-muted">Quantity {selectedFactor ? `(${selectedFactor.unit})` : ''}</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-semibold text-muted">Frequency</span>
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

              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="font-semibold text-muted">Change type</span>
                <div className="flex gap-2">
                  {(['REPLACE_WITH', 'REDUCE_BY'] as SimulationDeltaType[]).map((dt) => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setDeltaType(dt)}
                      className="flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors"
                      style={{
                        borderColor: deltaType === dt ? 'var(--lime)' : 'var(--border)',
                        background: deltaType === dt ? 'var(--lime-soft)' : 'var(--surface)',
                      }}
                    >
                      {dt === 'REPLACE_WITH' ? 'Replace with…' : 'Reduce by…'}
                    </button>
                  ))}
                </div>
              </label>

              {deltaType === 'REPLACE_WITH' ? (
                <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                  <span className="font-semibold text-muted">Replace with</span>
                  <select
                    value={replacementFactorKey}
                    onChange={(e) => setReplacementFactorKey(e.target.value)}
                    disabled={loadingFactors}
                    className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-semibold"
                  >
                    {factors.map((f) => (
                      <option key={f.factorKey} value={f.factorKey}>
                        {f.emoji} {f.label} ({f.factorKgPerUnit} kg/{f.unit})
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                  <span className="font-semibold text-muted">
                    Reduce the quantity by {selectedFactor ? `(${selectedFactor.unit})` : ''}
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
            </div>

            {error && <p className="text-sm font-semibold text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={submitting || loadingFactors || !selectedFactor}
              className="self-start rounded-xl bg-lime px-5 py-2.5 text-sm font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {submitting ? 'Simulating…' : 'Run simulation'}
            </button>
          </form>
        </Card>
      )}

      {result && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-[15px] font-bold">Projected impact</h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card className="!p-4 text-center">
              <div className="font-display text-xl font-extrabold">{result.baselineCo2Kg} kg</div>
              <div className="mt-0.5 text-[11px] font-semibold text-muted">Baseline CO₂</div>
            </Card>
            <Card className="!p-4 text-center">
              <div className="font-display text-xl font-extrabold" style={{ color: 'var(--lime-deep)' }}>
                {result.projectedCo2Kg} kg
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-muted">Projected CO₂</div>
            </Card>
            <Card className="!p-4 text-center">
              <div
                className="font-display text-xl font-extrabold"
                style={{ color: result.deltaCo2Kg <= 0 ? 'var(--lime-deep)' : '#e0a86a' }}
              >
                {result.deltaCo2Kg > 0 ? '+' : ''}{result.deltaCo2Kg} kg
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-muted">Change</div>
            </Card>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold">Weekly goal impact</span>
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
            <span className="text-sm font-semibold text-muted">Projected credits</span>
            <span className="font-display text-lg font-extrabold">+{result.projectedCreditsDelta}</span>
          </div>

          {result.breakdown.length > 0 && (
            <div className="flex flex-col divide-y divide-border">
              {result.breakdown.map((b) => (
                <div key={b.factorKey} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted">{b.factorKey}</span>
                  <span className="font-semibold">{b.baselineKg} kg → {b.projectedKg} kg</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
