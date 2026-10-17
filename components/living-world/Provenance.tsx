import type { Provenance } from '@/lib/living-world/types';

/**
 * The label every Living World number and visual carries, so a logged
 * footprint, a catalog estimate and a what-if never look alike.
 */
const META: Record<Provenance, { label: string; color: string; title: string }> = {
  logged: { label: 'Your logs', color: 'var(--lime)', title: 'From activities you logged. Each entry is an estimate from emission factors.' },
  example: { label: 'Example', color: '#c9b37e', title: 'An example, not your data.' },
  estimate: { label: 'Estimate', color: '#e0a86a', title: 'A typical value from the action catalog, not a measurement.' },
  hypothetical: { label: 'What if', color: '#7cc7e8', title: 'A Carbon Twin scenario. Nothing has been logged or saved.' },
  illustrative: { label: 'Illustrative', color: '#a99be0', title: 'A story visual, not data.' },
  sourced: { label: 'Sourced', color: '#8fc9a0', title: 'Third-party reference data with a citation.' },
};

export function ProvenanceBadge({ provenance, className = '' }: { provenance: Provenance; className?: string }) {
  const m = META[provenance];
  return (
    <span
      title={m.title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${className}`}
      style={{ color: m.color, borderColor: `color-mix(in srgb, ${m.color} 40%, transparent)`, background: `color-mix(in srgb, ${m.color} 10%, transparent)` }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function provenanceLabel(p: Provenance): string {
  return META[p].label;
}
