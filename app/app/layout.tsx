'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCarbon } from '@/lib/store';
import { isAuthenticated } from '@/lib/api/auth';
import { AmbientBackground } from '@/components/AmbientBackground';
import { Sidebar, MobileTopBar, BottomNav } from '@/components/app/AppNav';
import { Loading } from '@/components/app/ui';

import { AuthGuard } from '@/components/app/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { hydrated, bootstrapped, profile } = useCarbon();
  const router = useRouter();

  // For an authenticated user the real onboarded flag comes from the server, so
  // wait for the first fetch (bootstrapped) before deciding. Unauthenticated
  // users are handled by AuthGuard (-> /login), not the onboarding gate.
  const authed = hydrated && isAuthenticated();
  const needsOnboarding = authed && bootstrapped && !profile.onboarded;

  useEffect(() => {
    if (needsOnboarding) router.replace('/onboarding');
  }, [needsOnboarding, router]);

  if (!hydrated || (authed && !bootstrapped) || needsOnboarding) return <Loading />;

  return (
    <AuthGuard>
      <div className="relative min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <AmbientBackground />
        <Sidebar />
        <div className="relative z-[1] md:pl-[248px]">
          <MobileTopBar />
          <main id="main-content" className="mx-auto max-w-[880px] px-5 pb-28 pt-6 md:px-10 md:pb-14 md:pt-10">{children}</main>
        </div>
        <BottomNav />
      </div>
    </AuthGuard>
  );
}
