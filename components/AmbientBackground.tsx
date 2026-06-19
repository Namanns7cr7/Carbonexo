'use client';

/** Drifting radial glows + floating eco dots behind everything. */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -top-[12%] -right-[6%] w-[55vw] h-[55vw] max-w-[720px] max-h-[720px] rounded-full"
        style={{ background: 'radial-gradient(circle,var(--glow-a),transparent 66%)', animation: 'drift 22s ease-in-out infinite' }}
      />
      <div
        className="absolute -bottom-[18%] -left-[12%] w-[50vw] h-[50vw] max-w-[640px] max-h-[640px] rounded-full"
        style={{ background: 'radial-gradient(circle,var(--glow-b),transparent 66%)', animation: 'driftSlow 28s ease-in-out infinite' }}
      />
      {[
        { t: '18%', l: '12%', s: 9, c: 'var(--lime)', o: 0.35, a: 'drift 17s' },
        { t: '42%', r: '16%', s: 6, c: 'var(--blue)', o: 0.4, a: 'driftSlow 21s' },
        { t: '70%', l: '22%', s: 7, c: 'var(--lime)', o: 0.3, a: 'drift 24s' },
        { t: '30%', l: '46%', s: 5, c: 'var(--lime)', o: 0.25, a: 'driftSlow 19s' },
        { t: '85%', r: '30%', s: 8, c: 'var(--blue)', o: 0.3, a: 'drift 26s' },
      ].map((d, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            top: d.t, left: d.l, right: d.r, width: d.s, height: d.s,
            background: d.c, opacity: d.o, animation: `${d.a} ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}
