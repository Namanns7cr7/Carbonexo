'use client';

import { ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  className?: string;
  delay?: number;
  glow?: boolean;
  hoverEffect?: boolean;
}

/**
 * Competition-ready Dark Glassmorphism Wrapper Component
 * Features:
 * - Ultra-sleek glassmorphism (`backdrop-blur-md bg-slate-900/60 border border-emerald-500/20 shadow-lg shadow-emerald-500/5`)
 * - Emerald theme tokens (#10B981)
 * - Micro-interactive glowing hover effects & subtle radial shine
 * - Framer Motion entrance animation
 * - Non-intrusive container that preserves inner state, props, and hooks
 */
export function GlassCard({
  children,
  className = '',
  delay = 0,
  glow = true,
  hoverEffect = true,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative overflow-hidden rounded-[22px] border border-emerald-500/20 bg-slate-900/60 backdrop-blur-md shadow-lg shadow-emerald-500/5 transition-all duration-300 ${
        hoverEffect
          ? 'hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-0.5'
          : ''
      } ${className}`}
      {...props}
    >
      {/* Subtle emerald atmospheric top glow */}
      {glow && (
        <>
          <div
            className="pointer-events-none absolute -top-24 left-1/2 h-36 w-72 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl transition-opacity duration-500 group-hover:bg-emerald-500/15"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-emerald-500/[0.04] via-transparent to-transparent opacity-60"
            aria-hidden="true"
          />
        </>
      )}

      {/* Card Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

export default GlassCard;
