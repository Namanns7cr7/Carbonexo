'use client';

import { useEffect, useState } from 'react';
import { getBalance } from '@/lib/api/credits';
import { isAuthenticated } from '@/lib/api/auth';
import Link from 'next/link';

export function CreditBadge() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) return;
    getBalance()
      .then((res) => setBalance(res.balance))
      .catch(() => {});
  }, []);

  if (balance === null) return null;

  return (
    <Link href="/app/credits" className="flex items-center gap-1.5 rounded-full bg-lime-soft border border-lime/30 px-3 py-1 text-[13px] font-bold text-lime-deep hover:bg-lime/20 transition-all hover:scale-105">
      <span>🪙</span>
      <span>{balance} credits</span>
    </Link>
  );
}
