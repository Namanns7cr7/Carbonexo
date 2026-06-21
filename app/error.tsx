'use client';

import { useEffect } from 'react';

/**
 * Global error boundary — catches any uncaught client-side error (e.g.
 * expired-session race between redirect and React render) and offers
 * a clean recovery path instead of the default Next.js white error screen.
 */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[Carbonexo] Caught by error boundary:', error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-6"
      style={{ background: 'var(--bg, #f6f5ee)', color: 'var(--text, #0f231a)' }}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-4xl">🌿</span>
        <h2 className="font-display text-xl font-bold">Something went wrong</h2>
        <p className="text-sm text-[#5b6b62]">
          {error.message?.includes('Session expired') || error.message?.includes('CarbonexoProvider')
            ? 'Your session has expired. Please log in again.'
            : 'An unexpected error occurred.'}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => {
            // Clear stale auth state
            try {
              localStorage.removeItem('cx-refresh');
              localStorage.removeItem('cx-state');
            } catch {}
            window.location.href = '/login';
          }}
          className="rounded-xl bg-[#84cc16] px-6 py-3 text-sm font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5"
          style={{ boxShadow: '0 8px 24px -8px #84cc16' }}
        >
          Go to Login
        </button>
        <button
          onClick={reset}
          className="rounded-xl border border-[#e7e9e0] px-6 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
