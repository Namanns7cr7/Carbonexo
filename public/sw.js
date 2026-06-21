/* Carbonexo service worker — DISABLED.
 *
 * The previous network-first SW cached the app shell and, across a redeploy,
 * could serve a stale document that no longer matched the freshly-built JS
 * bundles. That mismatch caused fatal hydration errors (React #418/#423 and
 * "Cannot have more than one Element child of a Document").
 *
 * This version self-unregisters and clears every cache, so any browser that
 * still has the old SW installed is cleaned up on its next visit. The browser
 * fetches /sw.js on navigation, sees these new bytes, installs this SW, and
 * the activate step below removes itself — independent of the page JS, so it
 * recovers users even when the page failed to hydrate. */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: 'window' });
        // force a fresh, SW-free load of each open tab
        clients.forEach((c) => c.navigate(c.url));
      } catch {
        /* best-effort cleanup */
      }
    })()
  );
});
