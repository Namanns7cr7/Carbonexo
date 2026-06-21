'use client';

import { useState } from 'react';
import Link from 'next/link';
import { register } from '@/lib/api/auth';
import { Logo } from '@/components/Logo';
import { AmbientBackground } from '@/components/AmbientBackground';
import { Card } from '@/components/app/ui';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register(email, password, name);
      window.location.assign('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <AmbientBackground />
      <div className="relative z-10 w-full max-w-[440px] py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" aria-label="Carbonexo home">
            <Logo size={48} />
          </Link>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.03em]">Create account</h1>
          <p className="mt-2 text-[14px] text-muted">Join Carbonexo and start tracking your path to net-zero</p>
        </div>

        <Card className="!p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted">Your name label</label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Yash"
                className="w-full rounded-xl border border-border bg-surface2 px-4 py-3 text-sm font-semibold outline-none transition-colors focus:border-lime/60 focus:bg-surface"
              />
            </div>

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

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-wider text-muted">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>

          <GoogleSignInButton onError={setError} />
        </Card>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-lime-deep underline-offset-2 hover:underline">
            Log in here
          </Link>
        </p>
      </div>
    </div>
  );
}
