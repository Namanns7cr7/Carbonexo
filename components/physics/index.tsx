'use client';

/**
 * Physical interaction primitives — the DOM half of the living-planet motion
 * system (the globe half is lib/physics/globe.ts). Same rule everywhere:
 * things have mass, respond to input, and settle on springs. Nothing loops
 * for decoration.
 *
 * All of them:
 *  - stay plain links / buttons / divs to assistive tech and the keyboard,
 *  - drop to static under `prefers-reduced-motion`,
 *  - animate transforms only (no layout), off the React render path.
 */

import Link from 'next/link';
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, type HTMLMotionProps } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { railTravel } from '@/lib/experience/rail';

/** Shared DOM springs. Match SPRINGS in lib/physics/spring.ts: just under critical. */
export const UI_SPRING = { stiffness: 320, damping: 26, mass: 0.6 } as const;
export const MAGNET_SPRING = { stiffness: 180, damping: 16, mass: 0.5 } as const;

// ─── Magnetic, spring-loaded call to action ─────────────────────────────────

type MagneticProps = {
  /** Max pull toward the pointer, px. Kept small — restraint is the point. */
  strength?: number;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
} & ({ href: string; onClick?: () => void } | { href?: undefined; onClick?: () => void; type?: 'button' | 'submit' });

/**
 * A CTA that leans toward the pointer when it comes near, compresses under a
 * press, and springs back with a hint of overshoot. Renders a Next <Link> when
 * given `href`, otherwise a <button>.
 */
export function MagneticButton({ strength = 8, className = '', style, children, ...rest }: MagneticProps) {
  const reduce = useReducedMotion();
  const x = useSpring(0, MAGNET_SPRING);
  const y = useSpring(0, MAGNET_SPRING);
  const ref = useRef<HTMLSpanElement>(null);

  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== 'mouse' || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    x.set(Math.max(-1, Math.min(1, dx)) * strength);
    y.set(Math.max(-1, Math.min(1, dy)) * strength * 0.6);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  const inner = (
    <motion.span
      ref={ref}
      className={`relative inline-flex items-center justify-center gap-2 ${className}`}
      style={{ ...style, x, y }}
      // The link/button around this span is the focus target; without -1, framer's
      // press gesture would add a second, invisible tab stop here.
      tabIndex={-1}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={UI_SPRING}
    >
      {children}
    </motion.span>
  );

  // The hit area is a padded wrapper, so the pull starts before the pointer touches the button.
  const wrap = 'group -m-3 inline-flex rounded-[18px] p-3 outline-none [&:focus-visible>span]:ring-2 [&:focus-visible>span]:ring-[var(--lime)] [&:focus-visible>span]:ring-offset-2 [&:focus-visible>span]:ring-offset-[#030709]';
  if (rest.href !== undefined) {
    return (
      <Link href={rest.href} onClick={rest.onClick} onPointerMove={onMove} onPointerLeave={reset} className={wrap}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={'type' in rest ? rest.type ?? 'button' : 'button'} onClick={rest.onClick} onPointerMove={onMove} onPointerLeave={reset} className={wrap}>
      {inner}
    </button>
  );
}

// ─── Tactile card ───────────────────────────────────────────────────────────

/**
 * A surface with weight: lifts a few px on hover, presses down on tap, and
 * carries a soft light that follows the pointer across it. No tilt — rotation
 * hurts legibility and was one of the things the previous redesign overdid.
 */
export function TactileCard({ className = '', children, style, ...rest }: HTMLMotionProps<'div'> & { children: ReactNode }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const glow = useMotionTemplate`radial-gradient(420px circle at ${mx}% ${my}%, rgba(79,211,138,0.10), transparent 60%)`;

  return (
    <motion.div
      {...rest}
      className={`relative overflow-hidden ${className}`}
      style={{ ...style }}
      whileHover={reduce ? undefined : { y: -4 }}
      transition={UI_SPRING}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - r.left) / r.width) * 100);
        my.set(((e.clientY - r.top) / r.height) * 100);
      }}
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 motion-reduce:hidden" style={{ background: glow }} />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

// ─── Inertial rail ──────────────────────────────────────────────────────────

/**
 * A horizontal strip you can fling. Momentum with friction, rubber-banded at
 * both ends, and still a normal scroll region for keyboard and screen-reader
 * users (it scrolls natively when focused and arrow keys are used).
 */
export function InertialRail({
  children,
  className = '',
  label,
  onOverflowChange,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  /** Called with whether the items overflow, so a caller can show a drag hint only when there is something to drag. */
  onOverflowChange?: (overflowing: boolean) => void;
}) {
  const reduce = useReducedMotion();
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState(0);
  const draggable = !reduce && limit > 0;
  const dragged = useRef(false); // a drag must not also count as a click on a link inside the rail

  // The container (padding included) and the track are measured the same way in both modes.
  // Re-attached when the mode changes, because the elements are replaced.
  useEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const cs = getComputedStyle(outer.current);
      setLimit(railTravel(inner.current.scrollWidth, outer.current.clientWidth, parseFloat(cs.paddingLeft) || 0, parseFloat(cs.paddingRight) || 0));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [draggable]);

  useEffect(() => {
    onOverflowChange?.(limit > 0);
  }, [limit, onOverflowChange]);

  if (!draggable) {
    return (
      <div ref={outer} role="region" aria-label={label} tabIndex={0} className={`overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-[var(--lime)] ${className}`}>
        <div ref={inner} className="flex w-max gap-4">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div ref={outer} role="region" aria-label={label} className={`overflow-hidden ${className}`}>
      <motion.div
        ref={inner}
        className="flex w-max cursor-grab gap-4 active:cursor-grabbing"
        drag="x"
        dragConstraints={{ left: -limit, right: 0 }}
        dragElastic={0.12}
        dragTransition={{ power: 0.35, timeConstant: 320, bounceStiffness: 260, bounceDamping: 28 }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={() => {
          setTimeout(() => {
            dragged.current = false;
          }, 0);
        }}
        onClickCapture={(e) => {
          if (dragged.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        style={{ touchAction: 'pan-y' }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ─── Celebration ────────────────────────────────────────────────────────────

/**
 * A single spring ripple and a short label — the planet acknowledging a
 * completed action. It celebrates the *action*; it never claims something
 * grew or the world changed. Re-triggers whenever `trigger` changes.
 */
export function Celebrate({ trigger, label }: { trigger: number; label?: string }) {
  const reduce = useReducedMotion();
  if (!trigger) return null;
  return (
    <span key={trigger} aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {!reduce &&
        [0, 1].map((i) => (
          <motion.span
            key={i}
            className="absolute h-10 w-10 rounded-full border-2"
            style={{ borderColor: 'var(--lime)' }}
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 3.2 + i, opacity: 0 }}
            transition={{ duration: 0.9 + i * 0.25, ease: [0.2, 0.7, 0.2, 1], delay: i * 0.08 }}
          />
        ))}
      {label && (
        <motion.span
          className="absolute -top-2 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold"
          style={{ background: 'var(--lime)', color: '#0c1d15' }}
          initial={{ y: 6, opacity: 0, scale: 0.8 }}
          animate={{ y: -18, opacity: [0, 1, 1, 0], scale: 1 }}
          transition={{ duration: 1.6, times: [0, 0.15, 0.75, 1], type: 'tween' }}
        >
          {label}
        </motion.span>
      )}
    </span>
  );
}

