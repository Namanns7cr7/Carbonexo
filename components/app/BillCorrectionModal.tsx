'use client';

/**
 * BillCorrectionModal — inline modal for reviewing and correcting OCR-extracted
 * bill details before they are confirmed and converted to green credits.
 */
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { correctBill, type BillData } from '@/lib/api/bills';
import { Card, Eyebrow } from '@/components/app/ui';

interface BillCorrectionModalProps {
  /** The bill being corrected, or null to hide the modal. */
  bill: BillData | null;
  /** Called when the modal should close (cancelled or confirmed). */
  onClose: () => void;
  /** Called with the updated bill after a successful confirmation. */
  onConfirm: (updated: BillData) => void;
}

export function BillCorrectionModal({ bill, onClose, onConfirm }: BillCorrectionModalProps) {
  const [billingMonth, setBillingMonth] = useState(
    bill?.billingMonth?.substring(0, 7) ?? new Date().toISOString().substring(0, 7),
  );
  const [unitsConsumed, setUnitsConsumed] = useState(bill?.unitsConsumed ?? 0);
  const [billAmount, setBillAmount] = useState(bill?.billAmount ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bill) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await correctBill(bill.id, { billingMonth, unitsConsumed, billAmount });
      onConfirm(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm bill details. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {bill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bill-correction-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-[480px]"
          >
            <Card className="relative !p-6 shadow-strong">
              <button
                onClick={onClose}
                aria-label="Close bill correction"
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted hover:border-lime hover:text-text"
              >
                ✕
              </button>

              <Eyebrow>Verify Bill Extraction</Eyebrow>
              <h3 id="bill-correction-title" className="mb-4 text-lg font-bold">
                Confirm Parsed Details
              </h3>
              <p className="mb-4 text-xs text-muted">
                Please review the details parsed by our AI and correct them if needed. Confirming
                awards your green credits.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="billingMonth"
                    className="text-xs font-bold uppercase tracking-wider text-muted"
                  >
                    Billing Month (YYYY-MM)
                  </label>
                  <input
                    id="billingMonth"
                    type="month"
                    required
                    value={billingMonth}
                    onChange={(e) => setBillingMonth(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm font-semibold outline-none focus:border-lime/60 focus:bg-surface"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="unitsConsumed"
                    className="text-xs font-bold uppercase tracking-wider text-muted"
                  >
                    Units Consumed (kWh)
                  </label>
                  <input
                    id="unitsConsumed"
                    type="number"
                    required
                    min="0"
                    value={unitsConsumed}
                    onChange={(e) => setUnitsConsumed(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm font-semibold outline-none focus:border-lime/60 focus:bg-surface"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="billAmount"
                    className="text-xs font-bold uppercase tracking-wider text-muted"
                  >
                    Bill Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-sm font-bold text-muted">
                      {bill.currency || '₹'}
                    </span>
                    <input
                      id="billAmount"
                      type="number"
                      required
                      min="0"
                      value={billAmount}
                      onChange={(e) => setBillAmount(Number(e.target.value))}
                      className="w-full rounded-xl border border-border bg-surface2 py-2.5 pl-8 pr-4 text-sm font-semibold outline-none focus:border-lime/60 focus:bg-surface"
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl border border-blue/30 bg-blue-soft/20 px-4 py-3 text-center text-xs font-semibold text-blue">
                    ⚠️ {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-2 w-full rounded-xl bg-lime py-3 text-center text-sm font-bold text-[#0c1d15] transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? 'Confirming...' : 'Verify & Confirm'}
                </button>
              </form>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
