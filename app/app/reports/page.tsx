'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Printer } from 'lucide-react';
import { getEsgSummary, getEsgSummaryCsv, downloadEsgSummaryCsv, type EsgSummaryResponse } from '@/lib/api/reports';
import { useCarbon } from '@/lib/store';
import { Card, PageHead, Button, EmptyState } from '@/components/app/ui';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function ReportsPage() {
  const { profile } = useCarbon();
  const [data, setData] = useState<EsgSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  useEffect(() => {
    getEsgSummary()
      .then(setData)
      .catch(() => setError('Could not load your sustainability report. Try again shortly.'));
  }, []);

  const handleDownloadCsv = async () => {
    setDownloadingCsv(true);
    try {
      const csv = await getEsgSummaryCsv();
      downloadEsgSummaryCsv(csv);
    } catch {
      setError('Could not download the CSV. Try again shortly.');
    } finally {
      setDownloadingCsv(false);
    }
  };

  const categoryEntries = data ? Object.entries(data.categoryBreakdown).sort((a, b) => b[1] - a[1]) : [];
  const topCategory = categoryEntries[0]?.[1] ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <PageHead
          eyebrow="ESG / Sustainability export"
          title="Reports"
          sub="A clean, printable sustainability summary — built for employer or compliance exports (CSRD/BRSR-style reporting)."
        />
      </div>

      {error && (
        <div className="no-print">
          <EmptyState emoji="" title="Couldn't load report" sub={error} />
        </div>
      )}

      {!error && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card as="section" className="flex flex-col gap-6 !p-7">
            {/* document header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'var(--lime-soft)' }}>
                  <FileText className="h-5 w-5" style={{ color: 'var(--lime-deep)' }} strokeWidth={2.25} />
                </span>
                <div>
                  <div className="font-display text-xl font-extrabold">Sustainability Report</div>
                  <div className="text-sm text-muted">{profile.name}</div>
                </div>
              </div>
              <div className="text-right text-xs text-muted">
                {data && (
                  <>
                    <div>Generated {formatDate(data.generatedAt)}</div>
                    <div>Account since {formatDate(data.accountStartDate)}</div>
                  </>
                )}
              </div>
            </div>

            {/* summary stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { v: data ? `${data.currentMonthCo2Kg}` : '…', u: 'kg CO₂e logged this month', accent: true },
                { v: data ? `${data.creditsEarned}` : '…', u: 'credits earned' },
                { v: data ? `${data.currentStreak}` : '…', u: 'day streak' },
                { v: data ? `${data.totalActivitiesLogged}` : '…', u: 'activities logged' },
              ].map((s) => (
                <div key={s.u} className="rounded-xl border border-border bg-surface2 p-4 text-center">
                  <div className="font-display text-xl font-extrabold" style={{ color: s.accent ? 'var(--lime-deep)' : 'var(--text)' }}>{s.v}</div>
                  <div className="mt-0.5 text-[11px] font-semibold text-muted">{s.u}</div>
                </div>
              ))}
            </div>

            {/* category breakdown */}
            <div>
              <h2 className="mb-3 text-[15px] font-bold">Category breakdown</h2>
              {categoryEntries.length === 0 ? (
                <p className="text-sm text-muted">No activity recorded yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {categoryEntries.map(([cat, val]) => (
                    <div key={cat} className="flex items-center gap-4 py-2.5 text-sm">
                      <span className="w-32 flex-shrink-0 font-semibold capitalize">{cat.replace(/_/g, ' ')}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2">
                        <div className="h-full rounded-full" style={{ width: `${(val / topCategory) * 100}%`, background: 'var(--lime)' }} />
                      </div>
                      <span className="w-20 flex-shrink-0 text-right font-bold">{val} kg</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* signature footer */}
            <div className="border-t border-border pt-4 text-xs text-muted">
              Generated by Carbonexo — figures are derived from this account&apos;s own activity and credit ledger.
            </div>
          </Card>
        </motion.div>
      )}

      <div className="no-print flex flex-wrap gap-3">
        <Button variant="primary" onClick={() => window.print()} disabled={!data}>
          <Printer className="h-4 w-4" strokeWidth={2.25} />
          Download PDF
        </Button>
        <Button variant="secondary" onClick={handleDownloadCsv} disabled={!data || downloadingCsv}>
          <Download className="h-4 w-4" strokeWidth={2.25} />
          {downloadingCsv ? 'Preparing CSV…' : 'Download CSV'}
        </Button>
      </div>
    </div>
  );
}
