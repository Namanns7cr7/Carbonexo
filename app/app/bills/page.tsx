'use client';

/**
 * Bills page — electricity bill scanning and credit earning.
 *
 * Responsibilities:
 *  - Loads the list of uploaded bills from the API.
 *  - Delegates file upload to <BillUpload />.
 *  - Delegates bill verification to <BillCorrectionModal />.
 */
import { useState, useEffect } from 'react';
import { getBills, type BillData } from '@/lib/api/bills';
import { PageHead, Card } from '@/components/app/ui';
import { BillUpload } from '@/components/app/BillUpload';
import { BillCorrectionModal } from '@/components/app/BillCorrectionModal';

/** Badge showing the status of a scanned bill. */
function BillStatusBadge({ status }: { status: string }) {
  let className = 'bg-surface border border-border text-muted';
  if (status === 'CONFIRMED') className = 'bg-lime-soft text-lime-deep';
  else if (status === 'OCR_DONE') className = 'bg-blue-soft text-blue';

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${className}`}>
      {status}
    </span>
  );
}

export default function BillsPage() {
  const [bills, setBills] = useState<BillData[]>([]);
  const [correctingBill, setCorrectingBill] = useState<BillData | null>(null);

  useEffect(() => {
    getBills()
      .then(setBills)
      .catch((err) => console.error('[Bills] Failed to load bills:', err));
  }, []);

  const handleUploadSuccess = (newBill: BillData) => {
    setBills((prev) => [newBill, ...prev]);
    // Immediately open the correction modal so users can verify OCR output.
    if (newBill.status === 'OCR_DONE' || newBill.status === 'OCR_PENDING') {
      setCorrectingBill(newBill);
    }
  };

  const handleBillConfirmed = (updated: BillData) => {
    setBills((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setCorrectingBill(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="Electricity Bills"
        title="Automated Bill Scanning"
        sub="Upload your electricity bill. Our AI will automatically parse units and calculate carbon offset credits."
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main column: upload + history */}
        <div className="flex flex-col gap-5 md:col-span-2">
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
                        <span className="text-sm font-bold text-text">{bill.originalFilename}</span>
                        <BillStatusBadge status={bill.status} />
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
                          onClick={() => setCorrectingBill(bill)}
                          className="rounded-lg bg-lime px-3 py-1.5 text-xs font-bold text-[#0c1d15] transition-transform hover:scale-105"
                        >
                          Verify &amp; Confirm
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar: how it works */}
        <div className="flex flex-col gap-5">
          <Card className="!bg-lime-soft">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[11px] bg-lime text-base">
              ⚡
            </div>
            <h3 className="text-sm font-bold text-lime-deep">How it works</h3>
            <ol className="mt-2 flex flex-col gap-2 text-xs leading-[1.45] text-muted">
              <li>
                <strong className="text-text">1. Upload:</strong> Drag &amp; drop your PDF or image bill.
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
            </ol>
          </Card>
        </div>
      </div>

      {/* Bill correction modal */}
      <BillCorrectionModal
        bill={correctingBill}
        onClose={() => setCorrectingBill(null)}
        onConfirm={handleBillConfirmed}
      />
    </div>
  );
}
