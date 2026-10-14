'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, PageHead } from '@/components/app/ui';
import { ImpactGauge } from '@/components/app/charts';
import { lookupProduct, estimateEmbodiedCarbon, type ProductEstimateResult } from '@/lib/api/products';

const MANUAL_CATEGORIES = [
  { value: 'electronics', label: 'Electronics' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'packaged_food', label: 'Packaged food' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'appliances', label: 'Appliances' },
  { value: 'footwear', label: 'Footwear' },
  { value: 'toys', label: 'Toys' },
  { value: 'books', label: 'Books' },
];

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; found: boolean; productName: string | null; brand: string | null; categoryGuess: string | null };

export default function ScanPage() {
  const [barcode, setBarcode] = useState('');
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimate, setEstimate] = useState<ProductEstimateResult | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!barcode.trim()) return;
    setLookup({ status: 'loading' });
    setEstimate(null);
    setEstimateError(null);
    try {
      const res = await lookupProduct(barcode.trim());
      setLookup({ status: 'done', ...res });
      setCategory(res.categoryGuess ?? '');
    } catch {
      setLookup({ status: 'error', message: 'Lookup failed. You can still pick a category manually below.' });
      setCategory('');
    }
  };

  const handleEstimate = async () => {
    if (!category) return;
    setEstimating(true);
    setEstimateError(null);
    try {
      const productName = lookup.status === 'done' ? lookup.productName ?? undefined : undefined;
      const res = await estimateEmbodiedCarbon(category, quantity, productName);
      setEstimate(res);
    } catch {
      setEstimateError('Could not estimate embodied carbon for this category. Please try again.');
    } finally {
      setEstimating(false);
    }
  };

  const showManualCategoryPicker =
    lookup.status === 'idle' ||
    lookup.status === 'error' ||
    (lookup.status === 'done' && (!lookup.found || !lookup.categoryGuess));

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        eyebrow="Embodied carbon"
        title="Scan a purchase"
        sub="Enter a product barcode to see the embodied CO2e baked into it before you even use it, plus a lower-carbon alternative."
      />

      <Card className="flex flex-col gap-3">
        <label htmlFor="barcode" className="text-sm font-bold">
          Barcode
        </label>
        <div className="flex gap-2">
          <input
            id="barcode"
            type="text"
            inputMode="numeric"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="e.g. 737628064502"
            className="flex-1 rounded-xl border border-border bg-surface2 px-4 py-3 text-sm outline-none"
          />
          <button
            onClick={handleLookup}
            disabled={lookup.status === 'loading' || !barcode.trim()}
            className="rounded-xl bg-lime px-5 py-3 text-sm font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {lookup.status === 'loading' ? 'Looking up…' : 'Look up'}
          </button>
        </div>

        {lookup.status === 'error' && <p className="text-sm text-muted">{lookup.message}</p>}

        {lookup.status === 'done' && lookup.found && (
          <div className="rounded-xl border border-border bg-surface2 px-4 py-3 text-sm">
            <div className="font-bold">{lookup.productName ?? 'Unknown product'}</div>
            {lookup.brand && <div className="text-muted">{lookup.brand}</div>}
            {lookup.categoryGuess ? (
              <div className="mt-1 text-xs text-lime-deep">Matched category: {lookup.categoryGuess}</div>
            ) : (
              <div className="mt-1 text-xs text-muted">Couldn&apos;t guess a category — pick one below.</div>
            )}
          </div>
        )}

        {lookup.status === 'done' && !lookup.found && (
          <p className="text-sm text-muted">No product found for that barcode. Pick a category manually below.</p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        {showManualCategoryPicker && (
          <div className="flex flex-col gap-2">
            <label htmlFor="category" className="text-sm font-bold">
              Category
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-border bg-surface2 px-4 py-3 text-sm outline-none"
            >
              <option value="">Select a category…</option>
              {MANUAL_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="quantity" className="text-sm font-bold">
            Quantity
          </label>
          <input
            id="quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            className="w-28 rounded-xl border border-border bg-surface2 px-4 py-3 text-sm outline-none"
          />
        </div>

        <button
          onClick={handleEstimate}
          disabled={!category || estimating}
          className="rounded-xl bg-lime py-3.5 text-[15px] font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {estimating ? 'Estimating…' : 'Estimate embodied carbon'}
        </button>

        {estimateError && <p className="text-sm text-muted">{estimateError}</p>}
      </Card>

      {estimate && (() => {
        const altKg = estimate.alternativeSuggestion.estimatedKgCo2e;
        const savingsPct =
          altKg != null && estimate.estimatedKgCo2e > 0
            ? Math.round((1 - altKg / estimate.estimatedKgCo2e) * 100)
            : null;
        return (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Card className="flex flex-col gap-4 !bg-lime-soft">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            {savingsPct != null && (
              <ImpactGauge
                value={`${savingsPct}%`}
                unit="lower w/ swap"
                fraction={Math.min(1, Math.max(0, savingsPct) / 100)}
                size={130}
                color="var(--lime)"
                textColor="var(--lime-deep)"
              />
            )}
            <div className="flex-1">
              <div className="text-xs font-semibold uppercase tracking-wide text-lime-deep">Estimated embodied carbon</div>
              <div className="font-display text-[28px] font-extrabold">
                {estimate.estimatedKgCo2e.toFixed(2)} <span className="text-base font-bold text-muted">kg CO₂e</span>
              </div>
              {estimate.factorSource && <div className="mt-1 text-xs text-muted">Source: {estimate.factorSource}</div>}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Lower-carbon alternative</div>
            <p className="mt-1 text-sm">{estimate.alternativeSuggestion.text}</p>
            {altKg != null && (
              <p className="mt-1 text-xs text-lime-deep">
                ≈ {altKg.toFixed(2)} kg CO₂e instead
              </p>
            )}
          </div>
        </Card>
        </motion.div>
        );
      })()}
    </div>
  );
}
