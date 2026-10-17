'use client';

/**
 * Carbon Credit Vault.
 *
 * Two different things, kept visibly and structurally apart:
 *
 *  - **Green Points** — Carbonexo's own reward points (credit_ledger). Earned
 *    in the app, spent on in-app rewards. Not carbon credits: no registry, no
 *    tonnes, they offset nothing.
 *  - **Certified carbon credits** — issued by an independent registry, one
 *    unit = one tonne CO₂e, each with a serial range you can look up.
 *
 * They use different types (GreenPointsBalance vs CertifiedCredit), different
 * units (points vs tonnes) and separate panels, and no total ever adds them.
 *
 * This component only displays what it is given. It never issues, buys or
 * retires anything — retirement happens at the registry, and the caller
 * supplies the resulting records.
 */

import { useId } from 'react';
import type { CertifiedCredit, GreenPointsBalance, RetirementRecord } from '@/lib/experience/types';
import { EmptyBody, LoadingBody, VizCard } from './primitives';

function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const tonnes = (t: number) => `${t.toLocaleString('en-US', { maximumFractionDigits: 3 })} t CO₂e`;

export function GreenPointsCard({ points, loading, className = '' }: { points?: GreenPointsBalance | null; loading?: boolean; className?: string }) {
  const id = useId();
  return (
    <VizCard
      title="Green Points"
      labelledBy={id}
      className={className}
      subtitle="Carbonexo rewards for logging and completing actions."
      action={
        <span className="rounded-full bg-surface2 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">In-app reward</span>
      }
    >
      {loading ? (
        <LoadingBody rows={2} />
      ) : points ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[34px] font-extrabold leading-none tabular-nums">{points.balance.toLocaleString('en-US')}</span>
            <span className="text-[13px] font-semibold text-muted">points</span>
          </div>
          {points.earnedThisMonth !== undefined && (
            <p className="mt-2 text-[12.5px] text-muted">+{points.earnedThisMonth.toLocaleString('en-US')} this month</p>
          )}
        </>
      ) : (
        <EmptyBody>No points yet — log an activity to earn your first.</EmptyBody>
      )}
      <p className="mt-4 rounded-[12px] bg-surface2 px-3 py-2.5 text-[12px] leading-[1.5] text-muted">
        Points are not carbon credits. They aren’t issued by a registry, aren’t measured in tonnes, and don’t offset emissions.
      </p>
    </VizCard>
  );
}

export function CertifiedCredits({ credits, loading, className = '' }: { credits?: CertifiedCredit[] | null; loading?: boolean; className?: string }) {
  const id = useId();
  const held = (credits ?? []).filter((c) => c.status === 'held');
  const heldTonnes = held.reduce((s, c) => s + c.tonnes, 0);

  return (
    <VizCard
      title="Certified carbon credits"
      labelledBy={id}
      className={className}
      subtitle="Issued by independent registries. One credit = one tonne CO₂e."
      action={credits?.length ? <span className="font-mono text-[12px] font-bold tabular-nums">{tonnes(heldTonnes)} held</span> : undefined}
    >
      {loading ? (
        <LoadingBody />
      ) : !credits?.length ? (
        <EmptyBody>You don’t hold any certified credits. Credits bought through a registry appear here with their serial numbers.</EmptyBody>
      ) : (
        <ul className="space-y-3">
          {credits.map((c) => (
            <li key={c.id} className="rounded-[16px] border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[14px] font-bold">{c.projectName}</div>
                  <div className="mt-0.5 text-[12.5px] text-muted">
                    {c.projectType} · {c.country} · vintage {c.vintage}
                  </div>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                  style={c.status === 'retired' ? { background: 'var(--surface2)', color: 'var(--muted)' } : { background: 'var(--lime-soft)', color: 'var(--lime-deep)' }}
                >
                  {c.status === 'retired' ? 'Retired' : 'Held'} · {tonnes(c.tonnes)}
                </span>
              </div>
              <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-2">
                <div className="flex gap-2"><dt className="text-muted">Registry</dt><dd className="font-semibold">{c.registry}</dd></div>
                <div className="flex gap-2"><dt className="text-muted">Project ID</dt><dd className="font-mono">{c.projectId}</dd></div>
                {c.methodology && <div className="flex gap-2"><dt className="text-muted">Methodology</dt><dd className="font-mono">{c.methodology}</dd></div>}
                <div className="flex gap-2 sm:col-span-2"><dt className="shrink-0 text-muted">Serials</dt><dd className="break-all font-mono">{c.serialRange}</dd></div>
              </dl>
              {c.registryUrl && (
                <a
                  href={c.registryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-[12.5px] font-bold text-lime-deep underline-offset-4 hover:underline"
                >
                  Verify on registry ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </VizCard>
  );
}

export function RetirementHistory({ records, loading, className = '' }: { records?: RetirementRecord[] | null; loading?: boolean; className?: string }) {
  const id = useId();
  const total = (records ?? []).reduce((s, r) => s + r.tonnes, 0);
  return (
    <VizCard
      title="Retirement history"
      labelledBy={id}
      className={className}
      subtitle="Retired credits are cancelled at the registry so they can’t be sold again."
      action={records?.length ? <span className="font-mono text-[12px] font-bold tabular-nums">{tonnes(total)}</span> : undefined}
    >
      {loading ? (
        <LoadingBody />
      ) : !records?.length ? (
        <EmptyBody>No retirements yet.</EmptyBody>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left text-[12.5px]">
            <thead>
              <tr className="text-muted">
                {['Date', 'Project', 'Tonnes', 'Beneficiary', 'Serials'].map((h) => (
                  <th key={h} scope="col" className="border-b border-border px-1 pb-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="border-b border-border px-1 py-2.5 whitespace-nowrap">{fmtDate(r.retiredAt)}</td>
                  <td className="border-b border-border px-1 py-2.5">
                    <div className="font-semibold">{r.projectName}</div>
                    <div className="text-muted">{r.registry}</div>
                    {r.registryUrl && (
                      <a href={r.registryUrl} target="_blank" rel="noreferrer" className="font-bold text-lime-deep underline-offset-4 hover:underline">
                        Record ↗
                      </a>
                    )}
                  </td>
                  <td className="border-b border-border px-1 py-2.5 font-mono tabular-nums">{r.tonnes}</td>
                  <td className="border-b border-border px-1 py-2.5">
                    {r.beneficiary}
                    {r.reason && <div className="text-muted">{r.reason}</div>}
                  </td>
                  <td className="border-b border-border px-1 py-2.5 font-mono break-all">{r.serialRange}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </VizCard>
  );
}

/** The full vault: points and certified credits side by side, never combined. */
export function CarbonCreditVault({
  points,
  credits,
  retirements,
  loading,
  className = '',
}: {
  points?: GreenPointsBalance | null;
  credits?: CertifiedCredit[] | null;
  retirements?: RetirementRecord[] | null;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={`grid gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr] ${className}`}>
      <GreenPointsCard points={points} loading={loading} />
      <div className="space-y-4">
        <CertifiedCredits credits={credits} loading={loading} />
        <RetirementHistory records={retirements} loading={loading} />
      </div>
    </div>
  );
}
