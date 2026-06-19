'use client';

/** Circular progress ring + leaf mark + wordmark. */
export function Logo({ size = 38, withWordmark = true }: { size?: number; withWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-[11px]">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 38 38">
          <circle
            cx="19" cy="19" r="15.5" fill="none" stroke="var(--lime)" strokeWidth="3.6"
            strokeLinecap="round" strokeDasharray="97" strokeDashoffset="26"
            transform="rotate(-90 19 19)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-lime" style={{ width: size * 0.32, height: size * 0.32, borderRadius: '50% 14% 50% 50%', transform: 'rotate(45deg)' }} />
        </div>
      </div>
      {withWordmark && <span className="font-display text-[21px] font-bold tracking-[-0.02em]">Carbonexo</span>}
    </div>
  );
}
