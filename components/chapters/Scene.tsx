'use client';

import { useRef, type ReactNode } from 'react';
import { useScroll, type MotionValue } from 'framer-motion';

/**
 * A chapter of the scroll story.
 *
 * Full-viewport, labelled for assistive tech, and hands its children the
 * scroll progress across its own span so a scene can drive a camera from it.
 *
 * Deliberately NOT a scroll-hijacker: there is no pinning, no wheel capture
 * and no programmatic scrolling. The section is an ordinary document flow
 * element, so native scrolling, keyboard paging, find-in-page and browser
 * back all behave normally. Scenes only *read* progress.
 *
 * Uses 100svh rather than 100vh so mobile browser chrome collapsing does not
 * clip the scene or cause a scroll jump.
 */
export function Scene({
  id,
  label,
  children,
  className = '',
}: {
  id: string;
  /** Accessible name for the section — what this chapter is about. */
  label: string;
  children: (progress: MotionValue<number>) => ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  // 0 when the section's top meets the viewport top, 1 when its bottom leaves it.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  return (
    <section
      ref={ref}
      id={id}
      aria-label={label}
      className={`relative isolate min-h-[100svh] overflow-hidden ${className}`}
    >
      {children(scrollYProgress)}
    </section>
  );
}
