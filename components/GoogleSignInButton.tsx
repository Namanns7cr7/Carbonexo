'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithGoogle } from '@/lib/api/auth';

declare global {
  interface Window {
    google?: any;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCRIPT_ID = 'google-gsi-client';

/**
 * "Sign in with Google" button (Google Identity Services). Renders nothing when
 * NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset, so the rest of the auth UI is unaffected
 * until credentials are configured. On success it exchanges the Google ID token
 * for our own access/refresh tokens and routes into the app.
 */
export function GoogleSignInButton({ onError }: { onError?: (msg: string) => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;

    const init = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (response: { credential: string }) => {
          try {
            const res = await loginWithGoogle(response.credential);
            window.location.assign(res.user && !res.user.displayName ? '/onboarding' : '/app');
          } catch (e: any) {
            onError?.(e?.message || 'Google sign-in failed');
          }
        },
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        width: 360,
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'center',
      });
    };

    if (window.google) {
      init();
      return;
    }

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
    script.addEventListener('load', init);
    return () => script?.removeEventListener('load', init);
  }, [router, onError]);

  if (!CLIENT_ID) return null;

  return (
    <div className="mt-5 flex flex-col items-center gap-4">
      <div className="flex w-full items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <div ref={ref} className="flex justify-center" />
    </div>
  );
}
