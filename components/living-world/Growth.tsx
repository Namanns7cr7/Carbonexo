'use client';

/**
 * A sapling that grows with real progress (0…1): the stem rises on a spring
 * and a leaf unfurls at each quarter. It visualises a number the page already
 * shows in text — it never implies that anything was actually planted.
 */

import { motion, useReducedMotion } from 'framer-motion';

const LEAVES = [
  // The seedling's first leaf: always there, so zero progress still reads as a living thing.
  { at: 0, y: 84, side: 1 },
  { at: 0.25, y: 74, side: -1 },
  { at: 0.5, y: 56, side: 1 },
  { at: 0.75, y: 38, side: -1 },
  { at: 1, y: 22, side: 1 },
];

export function Growth({ progress, size = 72, label }: { progress: number; size?: number; label: string }) {
  const reduce = useReducedMotion();
  const p = Math.max(0, Math.min(1, progress));
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 70, damping: 14 };
  const top = 92 - (10 + 64 * p);
  return (
    <svg width={size} height={size} viewBox="0 0 80 100" role="img" aria-label={label}>
      <ellipse cx="40" cy="94" rx="22" ry="4" fill="var(--canopy-deep)" opacity="0.55" />
      <motion.line x1="40" x2="40" y1="92" stroke="var(--lime)" strokeOpacity="0.8" strokeWidth="4" strokeLinecap="round" initial={{ y2: 92 }} animate={{ y2: top }} transition={spring} />
      {LEAVES.map((l, i) => {
        const on = p >= l.at;
        return (
          <motion.path
            key={i}
            d={l.side < 0 ? `M40 ${l.y} C30 ${l.y - 12} 18 ${l.y - 6} 16 ${l.y + 2} C26 ${l.y + 6} 34 ${l.y + 4} 40 ${l.y}` : `M40 ${l.y} C50 ${l.y - 12} 62 ${l.y - 6} 64 ${l.y + 2} C54 ${l.y + 6} 46 ${l.y + 4} 40 ${l.y}`}
            fill="var(--lime)"
            style={{ originX: '40px', originY: `${l.y}px` }}
            initial={false}
            animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0, rotate: on ? 0 : l.side * -30 }}
            transition={{ ...spring, delay: reduce ? 0 : i * 0.06 }}
          />
        );
      })}
    </svg>
  );
}
