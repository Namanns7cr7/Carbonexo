'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useCarbon } from '@/lib/store';

import { CreditBadge } from './CreditBadge';

export const NAV = [
  { href: '/app', label: 'Home', icon: '🏠' },
  { href: '/app/track', label: 'Track', icon: '➕' },
  { href: '/app/insights', label: 'Insights', icon: '💡' },
  { href: '/app/actions', label: 'Actions', icon: '✅' },
  { href: '/app/coach', label: 'Coach', icon: '✦' },
  { href: '/app/bills', label: 'Bills', icon: '⚡' },
  { href: '/app/credits', label: 'Credits', icon: '🪙' },
  { href: '/app/rewards', label: 'Store', icon: '🛍️' },
];

export const MOBILE_NAV = [
  { href: '/app', label: 'Home', icon: '🏠' },
  { href: '/app/track', label: 'Track', icon: '➕' },
  { href: '/app/coach', label: 'Coach', icon: '✦' },
  { href: '/app/bills', label: 'Bills', icon: '⚡' },
  { href: '/app/rewards', label: 'Store', icon: '🛍️' },
];

function isActive(pathname: string, href: string) {
  return href === '/app' ? pathname === '/app' : pathname.startsWith(href);
}

/** Desktop left sidebar. */
export function Sidebar() {
  const pathname = usePathname();
  const { profile } = useCarbon();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-border px-4 py-6 md:flex" style={{ background: 'var(--navbg)', backdropFilter: 'blur(12px)' }}>
      <div className="mb-8 px-2 flex flex-col gap-3">
        <Link href="/" aria-label="Carbonexo home">
          <Logo />
        </Link>
        <div className="self-start mt-1">
          <CreditBadge />
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto cx-scroll">
        {NAV.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-3 rounded-[13px] px-3.5 py-3 text-[15px] font-semibold transition-colors"
              style={{
                background: active ? 'var(--lime-soft)' : 'transparent',
                color: active ? 'var(--lime-deep)' : 'var(--muted)',
              }}
            >
              <span className="text-lg">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <Link
        href="/app/profile"
        className="mt-2 flex items-center gap-3 rounded-[13px] border border-border px-3.5 py-3 transition-colors hover:border-lime"
        style={{ background: isActive(pathname, '/app/profile') ? 'var(--lime-soft)' : 'var(--surface)' }}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lime text-base font-bold text-[#0c1d15]">
          {profile.name.charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{profile.name}</span>
          <span className="block text-xs text-muted">View profile</span>
        </span>
      </Link>
      <div className="mt-4 flex items-center justify-between px-2">
        <span className="text-xs text-muted">Theme</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}

/** Mobile top bar (logo + theme + avatar). */
export function MobileTopBar() {
  const { profile } = useCarbon();
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border px-5 py-3 md:hidden" style={{ background: 'var(--navbg)', backdropFilter: 'blur(12px)' }}>
      <Link href="/" aria-label="Carbonexo home">
        <Logo size={32} />
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Link href="/app/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-lime text-base font-bold text-[#0c1d15]">
          {profile.name.charAt(0).toUpperCase()}
        </Link>
      </div>
    </header>
  );
}

/** Mobile bottom nav. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border px-1.5 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 md:hidden" style={{ background: 'var(--navbg)', backdropFilter: 'blur(14px)' }}>
      {MOBILE_NAV.map((n) => {
        const active = isActive(pathname, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className="flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition-colors"
            style={{ color: active ? 'var(--lime-deep)' : 'var(--muted)' }}
          >
            <span className="text-[19px] leading-none" style={{ filter: active ? 'none' : 'grayscale(0.2)' }}>{n.icon}</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
