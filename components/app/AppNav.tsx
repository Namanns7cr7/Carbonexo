'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Home,
  Plus,
  Lightbulb,
  CheckCircle,
  Sparkles,
  FlaskConical,
  PackageSearch,
  Users,
  Zap,
  Coins,
  ShoppingBag,
  Award,
  FileText,
  BookOpen,
  Trophy,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { logout } from '@/lib/api/auth';
import { useCarbon } from '@/lib/store';

import { CreditBadge } from './CreditBadge';

export const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/app', label: 'Home', icon: Home },
  { href: '/app/track', label: 'Track', icon: Plus },
  { href: '/app/insights', label: 'Insights', icon: Lightbulb },
  { href: '/app/actions', label: 'Actions', icon: CheckCircle },
  { href: '/app/coach', label: 'Coach', icon: Sparkles },
  { href: '/app/simulate', label: 'Simulate', icon: FlaskConical },
  { href: '/app/scan', label: 'Scan', icon: PackageSearch },
  { href: '/app/groups', label: 'Groups', icon: Users },
  { href: '/app/bills', label: 'Bills', icon: Zap },
  { href: '/app/credits', label: 'Credits', icon: Coins },
  { href: '/app/rewards', label: 'Store', icon: ShoppingBag },
  { href: '/app/score', label: 'Score', icon: Award },
  { href: '/app/reports', label: 'Reports', icon: FileText },
  { href: '/pitch.html', label: 'Judge Showcase', icon: Trophy },
  { href: '/methodology.html', label: 'Architecture', icon: BookOpen },
];

export const MOBILE_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/app', label: 'Home', icon: Home },
  { href: '/app/track', label: 'Track', icon: Plus },
  { href: '/app/coach', label: 'Coach', icon: Sparkles },
  { href: '/app/bills', label: 'Bills', icon: Zap },
  { href: '/app/rewards', label: 'Store', icon: ShoppingBag },
];

function isActive(pathname: string, href: string) {
  return href === '/app' ? pathname === '/app' : pathname.startsWith(href);
}

/** Desktop left sidebar. */
export function Sidebar() {
  const pathname = usePathname();
  const { profile } = useCarbon();
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r px-4 py-6 md:flex"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--navbg)',
        backdropFilter: 'blur(16px) saturate(180%)',
      }}
    >
      <div className="mb-8 flex flex-col gap-3 px-2">
        <Link href="/" aria-label="Carbonexo home">
          <Logo />
        </Link>
        <div className="mt-1 self-start">
          <CreditBadge />
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto cx-scroll">
        {NAV.map((n) => {
          const active = isActive(pathname, n.href);
          const Icon = n.icon;
          return (
            <motion.div key={n.href} whileHover={{ x: 2 }} transition={{ duration: 0.15 }}>
              <Link
                href={n.href}
                className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[14px] font-semibold transition-all"
                style={{
                  background: active ? 'var(--lime-soft)' : 'transparent',
                  color: active ? 'var(--lime-deep)' : 'var(--muted)',
                  boxShadow: active ? '0 2px 8px -2px rgba(16, 185, 129, 0.15)' : 'none',
                }}
              >
                <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2.5 : 2} />
                {n.label}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Profile & Logout card */}
      <div
        className="mt-2 flex items-center justify-between rounded-xl border p-2 transition-all hover:shadow-sm"
        style={{
          borderColor: isActive(pathname, '/app/profile') ? 'var(--lime)' : 'var(--border)',
          background: isActive(pathname, '/app/profile') ? 'var(--lime-soft)' : 'var(--surface)',
        }}
      >
        <Link href="/app/profile" className="flex flex-1 items-center gap-2.5 overflow-hidden px-1">
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
            style={{ background: 'linear-gradient(135deg, #10b981, #6366f1)' }}
          >
            {profile.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold">{profile.name}</span>
            <span className="block text-[11px] text-muted">View profile</span>
          </span>
        </Link>
        <button
          onClick={async () => {
            await logout();
            window.location.assign('/login');
          }}
          title="Sign out to Login page"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
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
    <header
      className="sticky top-0 z-40 flex items-center justify-between border-b px-5 py-3 md:hidden"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--navbg)',
        backdropFilter: 'blur(16px) saturate(180%)',
      }}
    >
      <Link href="/" aria-label="Carbonexo home">
        <Logo size={32} />
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Link
          href="/app/profile"
          className="flex h-9 w-9 items-center justify-center rounded-full text-base font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #10b981, #6366f1)' }}
        >
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
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t px-1.5 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 md:hidden"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--navbg)',
        backdropFilter: 'blur(16px) saturate(180%)',
      }}
    >
      {MOBILE_NAV.map((n) => {
        const active = isActive(pathname, n.href);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            className="flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition-colors"
            style={{ color: active ? 'var(--lime)' : 'var(--muted)' }}
          >
            <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.5 : 2} style={{ opacity: active ? 1 : 0.7 }} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
