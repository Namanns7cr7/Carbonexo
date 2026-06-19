'use client';

import { useState, useEffect } from 'react';
import { getBalance, getHistory, type CreditHistoryEntry } from '@/lib/api/credits';
import { PageHead, Card } from '@/components/app/ui';

export default function CreditsPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<CreditHistoryEntry[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [balData, histData] = await Promise.all([getBalance(), getHistory()]);
        setBalance(balData.balance);
        setHistory(histData);
      } catch (err) {
        console.error('Failed to load credit history', err);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        eyebrow="Green Credits Ledger"
        title="Your Impact Wallet"
        sub="Track every credit awarded for your green activities and spent in the rewards store."
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card className="flex flex-col items-center justify-center text-center py-8">
            <span className="text-4xl mb-3">🪙</span>
            <div className="text-xs font-bold uppercase tracking-wider text-muted mb-1">Current Balance</div>
            <div className="text-3xl font-black text-text">
              {balance !== null ? balance : '...'} <span className="text-sm font-bold text-muted">credits</span>
            </div>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <h2 className="mb-4 text-lg font-bold">Ledger History</h2>
            <div className="flex flex-col gap-3">
              {history.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">
                  No credit transactions recorded yet. Complete activities to start earning!
                </div>
              ) : (
                history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-4 py-3.5"
                  >
                    <div>
                      <div className="text-sm font-bold text-text">{entry.reason}</div>
                      <div className="mt-1 flex gap-2 items-center text-xs text-muted">
                        <span>{new Date(entry.createdAt).toLocaleString()}</span>
                        <span className="h-1 w-1 rounded-full bg-border" />
                        <span className="font-mono text-[10px] uppercase bg-surface px-1.5 py-0.5 rounded border border-border">
                          {entry.ruleKey || 'spend'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-sm font-extrabold ${
                          entry.delta > 0 ? 'text-lime-deep' : 'text-blue'
                        }`}
                      >
                        {entry.delta > 0 ? `+🪙 ${entry.delta}` : `-🪙 ${Math.abs(entry.delta)}`}
                      </span>
                      <div className="text-[10px] text-muted mt-0.5">
                        Bal: {entry.balanceAfter}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
