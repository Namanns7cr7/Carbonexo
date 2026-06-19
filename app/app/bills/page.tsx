'use client';

import { useState, useEffect } from 'react';
import { getBills, correctBill, type BillData } from '@/lib/api/bills';
import { PageHead, Card, Eyebrow } from '@/components/app/ui';
import { BillUpload } from '@/components/app/BillUpload';
import { motion, AnimatePresence } from 'framer-motion';

export default function BillsPage() {
  const [bills, setBills] = useState<BillData[]>([]);
  const [correctingBill, setCorrectingBill] = useState<BillData | null>(null);
  const [billingMonth, setBillingMonth] = useState('');
  const [unitsConsumed, setUnitsConsumed] = useState<number>(0);
  const [billAmount, setBillAmount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  const fetchBillsList = async () => {
    try {
      const data = await getBills();
      setBills(data);
    } catch (err) {
      console.error('Failed to load bills', err);
    }
  };

  useEffect(() => {
    fetchBillsList();
  }, []);

  const handleUploadSuccess = (newBill: BillData) => {
    setBills((prev) => [newBill, ...prev]);
    if (newBill.status === 'OCR_DONE' || newBill.status === 'OCR_PENDING') {
      openCorrection(newBill);
    }
  };

  const openCorrection = (bill: BillData) => {
    setCorrectingBill(bill);
    setBillingMonth(bill.billingMonth?.substring(0, 7) || new Date().toISOString().substring(0, 7));
    setUnitsConsumed(bill.unitsConsumed || 0);
    setBillAmount(bill.billAmount || 0);
  };

  const handleCorrectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingBill) return;
    setSubmitting(true);
    try {
      const updated = await correctBill(correctingBill.id, {
        billingMonth,
        unitsConsumed,
        billAmount,
      });
      setBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setCorrectingBill(null);
    } catch (err) {
      console.error('Failed to correct bill', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="Electricity Bills"
        title="Automated Bill Scanning"
        sub="Upload your electricity bill. Our AI will automatically parse units and calculate carbon offset credits."
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 flex flex-col gap-5">
          <Card>
            <h2 className="mb-4 text-lg font-bold">Upload New Bill</h2>
            <BillUpload onUploadSuccess={handleUploadSuccess} />
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-bold">Upload History</h2>
            <div className="flex flex-col gap-3">
              {bills.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">
                  No bills uploaded yet. Scan your first bill above.
                </div>
              ) : (
                bills.map((bill) => (
                  <div
                    key={bill.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface2 px-4 py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-text">
                          {bill.originalFilename}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            bill.status === 'CONFIRMED'
                              ? 'bg-lime-soft text-lime-deep'
                              : bill.status === 'OCR_DONE'
                              ? 'bg-blue-soft text-blue'
                              : 'bg-surface border border-border text-muted'
                          }`}
                        >
                          {bill.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
                        {bill.billingMonth && (
                          <span>
                            Month: <strong>{bill.billingMonth.substring(0, 7)}</strong>
                          </span>
                        )}
                        {bill.unitsConsumed !== null && (
                          <span>
                            Units: <strong>{bill.unitsConsumed} kWh</strong>
                          </span>
                        )}
                        {bill.billAmount !== null && (
                          <span>
                            Amount: <strong>{bill.currency} {bill.billAmount}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={bill.blobUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-text hover:bg-surface"
                      >
                        View Document
                      </a>
                      {(bill.status === 'OCR_DONE' || bill.status === 'UPLOADED') && (
                        <button
                          onClick={() => openCorrection(bill)}
                          className="rounded-lg bg-lime px-3 py-1.5 text-xs font-bold text-[#0c1d15] hover:scale-105 transition-transform"
                        >
                          Verify & Confirm
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card className="!bg-lime-soft">
            <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-lime text-base mb-3">⚡</div>
            <h3 className="text-sm font-bold text-lime-deep">How it works</h3>
            <ul className="mt-2 flex flex-col gap-2 text-xs leading-[1.45] text-muted">
              <li>
                <strong className="text-text">1. Upload:</strong> Drag & drop your PDF or image bill.
              </li>
              <li>
                <strong className="text-text">2. AI Scan:</strong> Google Vision OCR extracts billing period and kWh consumed.
              </li>
              <li>
                <strong className="text-text">3. Verify:</strong> Review the extracted data and hit confirm.
              </li>
              <li>
                <strong className="text-text">4. Earn:</strong> Unlock green credits for tracking your energy consumption!
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {correctingBill && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-[480px]"
            >
              <Card className="!p-6 relative shadow-strong">
                <button
                  onClick={() => setCorrectingBill(null)}
                  className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted hover:text-text hover:border-lime"
                >
                  ✕
                </button>
                <Eyebrow>Verify Bill Extraction</Eyebrow>
                <h3 className="text-lg font-bold mb-4">Confirm Parsed Details</h3>
                <p className="text-xs text-muted mb-4">
                  Please review the details parsed by our AI and correct them if needed. Confirming awards your green credits.
                </p>

                <form onSubmit={handleCorrectSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted">
                      Billing Month (YYYY-MM)
                    </label>
                    <input
                      type="month"
                      required
                      value={billingMonth}
                      onChange={(e) => setBillingMonth(e.target.value)}
                      className="w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm font-semibold outline-none focus:border-lime/60 focus:bg-surface"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted">
                      Units Consumed (kWh)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={unitsConsumed}
                      onChange={(e) => setUnitsConsumed(Number(e.target.value))}
                      className="w-full rounded-xl border border-border bg-surface2 px-4 py-2.5 text-sm font-semibold outline-none focus:border-lime/60 focus:bg-surface"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted">
                      Bill Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-2.5 text-sm font-bold text-muted">
                        {correctingBill.currency || '₹'}
                      </span>
                      <input
                        type="number"
                        required
                        min="0"
                        value={billAmount}
                        onChange={(e) => setBillAmount(Number(e.target.value))}
                        className="w-full rounded-xl border border-border bg-surface2 pl-8 pr-4 py-2.5 text-sm font-semibold outline-none focus:border-lime/60 focus:bg-surface"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-2 w-full rounded-xl bg-lime py-3 text-center text-sm font-bold text-[#0c1d15] hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    {submitting ? 'Confirming...' : 'Verify & Confirm'}
                  </button>
                </form>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
