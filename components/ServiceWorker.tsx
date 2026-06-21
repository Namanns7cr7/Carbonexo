'use client';

import { useEffect } from 'react';

/**
 * Service worker DISABLED. The previous network-first SW cached the app shell
 * and could serve a stale document across deploys, causing fatal hydration
 * mismatches (React #418/#423). Instead of registering a SW, we actively
 * unregister any that a returning visitor still has and clear its caches.
 * (The self-destruct logic in /sw.js handles browsers whose page never
 * hydrated; this is the belt-and-suspenders cleanup for those that do.)
 */
export function ServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
    if ('caches' in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }, []);
  return null;
}
