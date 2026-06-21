'use client';

import { useState } from 'react';
import Link from 'next/link';
import { login } from '@/lib/api/auth';
import { Logo } from '@/components/Logo';
import { AmbientBackground } from '@/components/AmbientBackground';
import { Card } from '@/components/app/ui';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await login(email, password);
      // full navigation so the store remounts and loads the server profile
      window.location.assign(res.user && !res.user.displayName ? '/onboarding' : '/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <AmbientBackground />
      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" aria-label="Carbonexo home">
            <Logo size={48} />
          </Link>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.03em]">Welcome back</h1>
          <p className="mt-2 text-[14px] text-muted">Log in to continue tracking your carbon footprint</p>
        </div>

        <Card className="!p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted">Email address</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm font-semibold outline-none transition-colors focus:border-lime/60 focus:bg-surface"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm font-semibold outline-none transition-colors focus:border-lime/60 focus:bg-surface"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-blue-soft/20 border border-blue/30 px-4 py-3 text-xs font-semibold text-blue text-center">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-lime py-3.5 text-center text-sm font-bold text-[#0c1d15] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              style={{ boxShadow: '0 8px 24px -8px var(--lime)' }}
            >
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <GoogleSignInButton onError={setError} />
        </Card>

        <p className="mt-6 text-center text-sm text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-bold text-lime-deep underline-offset-2 hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
