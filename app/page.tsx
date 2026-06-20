'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/api/auth';
import { Loading } from '@/components/app/ui';

/** App entry point: send signed-in users to the app, everyone else to login.
 *  The marketing landing page lives at /welcome. */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(isAuthenticated() ? '/app' : '/login');
  }, [router]);

  return <Loading />;
}
