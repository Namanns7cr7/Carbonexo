'use client';

/**
 * Route transition for every /app screen. A template (unlike the layout)
 * remounts on navigation, so each screen settles in on the shared UI spring
 * while the shell, the backdrop and the Living World state stay put.
 * MotionConfig reducedMotion="user" in the layout turns the movement off for
 * viewers who asked for less; the fade alone remains.
 */

import { motion } from 'framer-motion';
import { UI_SPRING } from '@/components/physics';

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ opacity: { duration: 0.25 }, y: { type: 'spring', ...UI_SPRING } }}>
      {children}
    </motion.div>
  );
}
