'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Fade-up reveal on scroll. Replaces the prototype's IntersectionObserver
 * + opacity:0 pattern (which had a fail-safe because IO didn't fire when
 * bundled — framer-motion's whileInView is reliable, so no fallback needed).
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.75, delay: delay / 1000, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
