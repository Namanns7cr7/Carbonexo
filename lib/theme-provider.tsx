'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

type Theme = 'light' | 'dark';

/** Pages that always render dark, whatever the user picked elsewhere. Mirrored in app/layout.tsx's flash guard. */
export const FORCED_DARK_PATHS = ['/login'];
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Dark is the default: the first render must agree with the flash guard in app/layout.tsx.
  const [theme, setTheme] = useState<Theme>('dark');
  const [ready, setReady] = useState(false);
  const forcedDark = FORCED_DARK_PATHS.includes(usePathname() ?? '');

  // hydrate from storage / system preference
  useEffect(() => {
    // Every visit opens dark; a switch to light lasts for this tab only (sessionStorage).
    const stored = sessionStorage.getItem('cx-theme') as Theme | null;
    const initial: Theme = stored ?? 'dark';
    setTheme(initial);
    setReady(true);
  }, []);

  // reflect onto <html class="dark"> + persist (the user's choice, not the forced one)
  useEffect(() => {
    if (!ready) return; // don't overwrite the guard's class or the stored choice before hydrating
    document.documentElement.classList.toggle('dark', forcedDark || theme === 'dark');
    sessionStorage.setItem('cx-theme', theme);
  }, [theme, forcedDark, ready]);

  const toggle = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);

  return <ThemeCtx.Provider value={{ theme: forcedDark ? 'dark' : theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
