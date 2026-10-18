'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/api/auth';

/** Sends a signed-in visitor on to the app; renders nothing, so the page underneath paints without waiting for it. */
export function RedirectIfSignedIn({ to = '/app' }: { to?: string }) {
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) router.replace(to);
  }, [router, to]);

  return null;
}
