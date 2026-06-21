'use client';

import { useTheme } from '@/lib/theme-provider';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="relative h-[31px] w-[58px] flex-shrink-0 rounded-full border border-border bg-surface2"
    >
      <span
        className="absolute top-[3px] left-[3px] flex h-[23px] w-[23px] items-center justify-center rounded-full bg-lime text-[13px] leading-none shadow transition-transform duration-[420ms]"
        style={{ transform: dark ? 'translateX(27px)' : 'translateX(0)', transitionTimingFunction: 'cubic-bezier(.4,1.3,.5,1)' }}
      >
        <span role="img" aria-hidden="true">{dark ? '🌙' : '☀️'}</span>
      </span>
    </button>
  );
}
