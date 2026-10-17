'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import { useCarbon } from '@/lib/store';
import { isAuthenticated } from '@/lib/api/auth';
import { LivingWorldProvider } from '@/lib/living-world/LivingWorldProvider';
import { WorldBackdrop } from '@/components/living-world/WorldBackdrop';
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
      {/* One Living World for the whole app shell: every screen reads the same state. */}
      <LivingWorldProvider>
        {/* reducedMotion="user": Framer drops transform/layout motion for viewers who asked for less, app-wide. */}
        <MotionConfig reducedMotion="user">
          <div className="relative min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
            <div className="no-print">
              <WorldBackdrop />
            </div>
            <div className="no-print">
              <Sidebar />
            </div>
            <div className="relative z-[1] md:pl-[248px] print:pl-0">
              <div className="no-print">
                <MobileTopBar />
              </div>
              <main id="main-content" className="mx-auto max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 md:px-8 md:pb-14 md:pt-8">{children}</main>
            </div>
            <div className="no-print">
              <BottomNav />
            </div>
          </div>
        </MotionConfig>
      </LivingWorldProvider>
    </AuthGuard>
  );
}
