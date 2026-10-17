'use client';

/**
 * Impact Passport — a personal record of the journey so far. Stamps are
 * passed in already earned or not; this component never decides eligibility.
 * Avoided emissions are always labelled as an estimate.
 */

import { useId } from 'react';
import type { ImpactPassportData } from '@/lib/experience/types';
import { formatKg } from '@/lib/experience/viz';
import { EmptyBody, LoadingBody } from './primitives';

function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ImpactPassport({ data, loading, className = '' }: { data?: ImpactPassportData | null; loading?: boolean; className?: string }) {
  const id = useId();

  const shell = (children: React.ReactNode) => (
    <section
      aria-labelledby={id}
      className={`relative overflow-hidden rounded-[24px] border p-6 text-white shadow-card ${className}`}
      style={{
        background: 'linear-gradient(150deg, var(--canopy) 0%, var(--canopy-deep) 55%, #041a12 100%)',
        borderColor: 'rgba(184,232,212,0.2)',
      }}
    >
      {/* guilloché-style rings — print security texture, purely decorative */}
      <svg aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 opacity-[0.12]" viewBox="0 0 200 200">
        {Array.from({ length: 9 }).map((_, i) => (
          <circle key={i} cx="100" cy="100" r={20 + i * 9} fill="none" stroke="var(--mint)" strokeWidth="0.8" />
        ))}
      </svg>
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em]" style={{ color: 'var(--mint)' }}>
              Carbonexo · Impact Passport
            </p>
            <h3 id={id} className="mt-2 font-display text-[22px] font-extrabold leading-tight tracking-[-0.02em]">
              {data?.holder ?? 'Impact Passport'}
            </h3>
          </div>
          <svg aria-hidden="true" width="38" height="38" viewBox="0 0 38 38">
            <circle cx="19" cy="19" r="15.5" fill="none" stroke="var(--mint)" strokeWidth="3" strokeDasharray="97" strokeDashoffset="26" transform="rotate(-90 19 19)" />
          </svg>
        </div>
        {children}
      </div>
    </section>
  );

  if (loading) return shell(<div className="mt-5 opacity-60"><LoadingBody /></div>);
  if (!data) return shell(<div className="mt-5"><EmptyBody>Your passport starts with your first logged day.</EmptyBody></div>);

  const earned = data.stamps.filter((s) => s.earnedAt).length;

  return shell(
    <>
      <p className="mt-1 text-[12.5px] text-white/60">Member since {fmtDate(data.memberSince)}</p>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        {[
          { k: 'Days tracked', v: String(data.daysTracked) },
          { k: 'Actions done', v: String(data.actionsCompleted) },
          { k: 'Avoided (est.)', v: formatKg(data.kgAvoidedEstimate) },
        ].map((s) => (
          <div key={s.k} className="rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-3">
            <dt className="text-[11px] font-semibold text-white/55">{s.k}</dt>
            <dd className="mt-1 font-display text-[20px] font-extrabold tabular-nums">{s.v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex items-baseline justify-between">
        <h4 className="text-[13px] font-bold">Stamps</h4>
        <span className="font-mono text-[11px] text-white/50">
          {earned} / {data.stamps.length}
        </span>
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {data.stamps.map((s, i) => {
          const got = Boolean(s.earnedAt);
          return (
            <li key={s.id} className="flex flex-col items-center text-center">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full text-[20px]"
                style={
                  got
                    ? {
                        border: '2px solid var(--mint)',
                        color: 'var(--mint)',
                        background: 'rgba(184,232,212,0.08)',
                        transform: `rotate(${((i * 37) % 21) - 10}deg)`,
                      }
                    : { border: '2px dashed rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.22)' }
                }
                aria-hidden="true"
              >
                {s.mark}
              </span>
              <span className={`mt-2 text-[11px] font-semibold leading-tight ${got ? 'text-white/85' : 'text-white/35'}`}>{s.label}</span>
              <span className="sr-only">{got ? `earned ${fmtDate(s.earnedAt!)}` : 'not yet earned'}</span>
              {got && <span aria-hidden="true" className="mt-0.5 font-mono text-[9.5px] text-white/40">{fmtDate(s.earnedAt!)}</span>}
            </li>
          );
        })}
      </ul>

      <p className="mt-5 text-[11px] leading-[1.5] text-white/45">
        Avoided emissions are estimated from typical savings for completed actions, not measured.
      </p>
    </>
  );
}
