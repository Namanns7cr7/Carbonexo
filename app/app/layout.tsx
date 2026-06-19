'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCarbon } from '@/lib/store';
import { AmbientBackground } from '@/components/AmbientBackground';
import { Sidebar, MobileTopBar, BottomNav } from '@/components/app/AppNav';
import { Loading } from '@/components/app/ui';

import { AuthGuard } from '@/components/app/AuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { hydrated, profile } = useCarbon();
  const router = useRouter();

  // onboarding gate — only after hydration so we know the real value
  useEffect(() => {
    if (hydrated && !profile.onboarded) router.replace('/onboarding');
  }, [hydrated, profile.onboarded, router]);

  if (!hydrated || !profile.onboarded) return <Loading />;

  return (
    <AuthGuard>
      <div className="relative min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <AmbientBackground />
        <Sidebar />
        <div className="relative z-[1] md:pl-[248px]">
          <MobileTopBar />
          <main className="mx-auto max-w-[880px] px-5 pb-28 pt-6 md:px-10 md:pb-14 md:pt-10">{children}</main>
        </div>
        <BottomNav />
      </div>
    </AuthGuard>
  );
}
