'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithGoogle } from '@/lib/api/auth';

interface GoogleIdConfig {
  client_id: string;
  use_fedcm_for_prompt?: boolean;
  callback: (response: { credential: string }) => void;
}

interface GoogleButtonOptions {
  theme?: string;
  size?: string;
  width?: number;
  text?: string;
  shape?: string;
  logo_alignment?: string;
}

interface GoogleAccounts {
  accounts: {
    id: {
      initialize: (config: GoogleIdConfig) => void;
      renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
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
  // One exchange at a time: a second tap while the first is in flight would
  // start a competing sign-in and make the page look like it bounced back.
  const pending = useRef(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;

    // Wake the backend while the visitor is still choosing an account, so the
    // token exchange does not sit behind a cold start.
    fetch(`${API_BASE_URL}/actuator/health`, { cache: 'no-store' }).catch(() => {});

    const init = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        use_fedcm_for_prompt: true,
        callback: async (response: { credential: string }) => {
          if (pending.current) return;
          pending.current = true;
          setSigningIn(true);
          try {
            const res = await loginWithGoogle(response.credential);
            // stays "signing in" until the next page replaces this one
            window.location.assign(res.user && !res.user.displayName ? '/onboarding' : '/app');
          } catch (e) {
            pending.current = false;
            setSigningIn(false);
            onError?.(e instanceof Error ? e.message : 'Google sign-in failed');
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
      <div ref={ref} className={signingIn ? 'hidden' : 'flex justify-center'} />
      {signingIn && (
        <div role="status" aria-live="polite" className="flex h-10 items-center gap-2 text-sm font-semibold text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          Signing you in with Google…
        </div>
      )}
    </div>
  );
}
