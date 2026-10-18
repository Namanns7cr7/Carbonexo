'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated } from '@/lib/api/auth';
import { beginSignOut } from '@/lib/api/client';
import { TOKEN_REFRESH_KEY } from '@/lib/constants';
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

  // Signed out in another tab: the refresh token left shared storage. Drop this
  // tab's in-memory session and private screens too (a rotation writes a new
  // token, it never removes one).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      const removed = e.key === TOKEN_REFRESH_KEY ? e.newValue === null : e.key === null;
      if (!removed || localStorage.getItem(TOKEN_REFRESH_KEY)) return;
      beginSignOut();
      window.location.replace('/');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (loading) {
    return <Loading />;
  }

  return <>{children}</>;
}
