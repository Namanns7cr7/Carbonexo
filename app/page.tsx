'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/api/auth';
import { Loading } from '@/components/app/ui';

/** App entry point: send signed-in users to the app, everyone else to the
 *  Living Earth landing at /welcome (which links on to sign in). */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(isAuthenticated() ? '/app' : '/welcome');
  }, [router]);

  return <Loading />;
}
