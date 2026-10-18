'use client';

import { useEffect, useState } from 'react';
import { Card, Button } from '@/components/app/ui';
import { confirmRegion, getRegion, type RegionStatus } from '@/lib/api/profile';
import { isAuthenticated } from '@/lib/api/auth';

const REGION_NAMES: Record<string, string> = { IN: 'India', GB: 'United Kingdom', US: 'United States', GLOBAL: 'Global average' };

/**
 * Lets the user confirm or change the region used to pick emission factors. Never set
 * automatically. Confirming a region does not make unreviewed factors approved.
 */
export function RegionConfirmCard() {
  const [status, setStatus] = useState<RegionStatus | null>(null);
  const [choice, setChoice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) return;
    getRegion()
      .then((s) => {
        setStatus(s);
        setChoice(s.region);
      })
      .catch(() => setError('Region settings are unavailable right now.'));
  }, []);

  if (!status && !error) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      setStatus(await confirmRegion(choice));
    } catch {
      setError('Could not save your region. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-bold">Region for emission estimates</h2>
      <p className="mb-3 text-sm text-muted">
        Carbonexo uses factors for your country where they exist. Choose where you live; we never guess it from your location.
      </p>
      {status && (
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="region-select" className="sr-only">Region</label>
          <select
            id="region-select"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold"
          >
            {status.supported.map((r) => (
              <option key={r} value={r}>{REGION_NAMES[r] ?? r}</option>
            ))}
          </select>
          <Button variant="primary" onClick={save} disabled={saving || (status.confirmed && choice === status.region)}>
            {saving ? 'Saving…' : status.confirmed && choice === status.region ? '✓ Confirmed' : 'Confirm region'}
          </Button>
          <span className="text-xs text-muted" data-testid="region-status">
            {status.confirmed ? `Confirmed: ${REGION_NAMES[status.region] ?? status.region}` : 'Not confirmed yet'}
          </span>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-amber-600">{error}</p>}
    </Card>
  );
}
