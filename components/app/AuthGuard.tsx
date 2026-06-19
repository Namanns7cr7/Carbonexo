'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '@/lib/api/auth';
import { Loading } from './ui';

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const authed = isAuthenticated();
      const isAuthRoute = pathname === '/login' || pathname === '/register';

      if (!authed && !isAuthRoute) {
        router.replace('/login');
      } else if (authed && isAuthRoute) {
        router.replace('/app');
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  if (loading) {
    return <Loading />;
  }

  return <>{children}</>;
}
