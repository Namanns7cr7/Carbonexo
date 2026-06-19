'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { Logo } from './Logo';

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#swap', label: 'Carbon Swap' },
  { href: '#coach', label: 'AI Coach' },
  { href: '#progress', label: 'Progress' },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState<string>('');

  // scroll progress bar
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // active link highlighting
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' }
    );
    ['features', 'swap', 'coach', 'progress'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-border backdrop-blur-md" style={{ background: 'var(--navbg)' }}>
      <div
        className="absolute left-0 -bottom-[1.5px] h-[3px] rounded-r-sm transition-[width] duration-100"
        style={{ width: `${progress * 100}%`, background: 'linear-gradient(90deg,var(--lime),var(--blue))', boxShadow: '0 0 8px var(--lime)' }}
      />
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-5 px-6 py-[13px]">
        <Link href="/" aria-label="Carbonexo home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-[30px] md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[15px] font-semibold transition-colors"
              style={{ color: active === l.href.slice(1) ? 'var(--lime)' : 'var(--muted)' }}
            >
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/onboarding"
            className="hidden rounded-xl bg-lime px-5 py-[11px] text-sm font-bold text-[#0c1d15] transition-transform hover:-translate-y-px md:inline-block"
          >
            Start Tracking
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            className="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-surface md:hidden"
          >
            <span className="h-0.5 w-[18px] rounded bg-text" />
            <span className="h-0.5 w-[18px] rounded bg-text" />
            <span className="h-0.5 w-[18px] rounded bg-text" />
          </button>
        </div>
      </div>
      {open && (
        <div className="flex flex-col gap-1 border-t border-border bg-surface px-6 pb-5 pt-3.5 md:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-[10px] px-1.5 py-3 text-base font-semibold text-text">
              {l.label}
            </a>
          ))}
          <Link href="/onboarding" onClick={() => setOpen(false)} className="mt-2 rounded-xl bg-lime py-3.5 text-center text-[15px] font-bold text-[#0c1d15]">
            Start Tracking
          </Link>
        </div>
      )}
    </nav>
  );
}
