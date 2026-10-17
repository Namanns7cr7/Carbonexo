'use client';

import { useEffect, useState } from 'react';
import { getBalance } from '@/lib/api/credits';
import { isAuthenticated } from '@/lib/api/auth';
import Link from 'next/link';
import { useOptionalLivingWorld } from '@/lib/living-world/LivingWorldProvider';

export function CreditBadge() {
  const [fetched, setFetched] = useState<number | null>(null);
  // Inside the app shell the shared Living World already reads the ledger and re-reads it after
  // actions and redemptions, so the badge follows the real balance without its own refetch.
  const lw = useOptionalLivingWorld();
  const balance = lw?.world.ledger?.balance ?? fetched;

  useEffect(() => {
    if (!isAuthenticated() || lw) return;
    getBalance()
      .then((res) => setFetched(res.balance))
      .catch(() => {});
  }, [lw]);

  if (balance === null) return null;

  return (
    <Link href="/app/credits" className="flex items-center gap-1.5 rounded-full bg-lime-soft border border-lime/30 px-3 py-1 text-[13px] font-bold text-lime-deep hover:bg-lime/20 transition-all hover:scale-105">
      <span aria-hidden className="h-2 w-2 rounded-full bg-amber-400" />
      <span>{balance.toLocaleString()} Green Points</span>
    </Link>
  );
}
