'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts from 0 → `to` once the element scrolls into view.
 * Returns a ref to attach to the element, and the formatted display value.
 */
export function useCountUp(to: number, { decimals = 0, duration = 1400, suffix = '' } = {}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const run = () => {
      if (done.current) return;
      done.current = true;
      const start = performance.now();
      const step = (now: number) => {
        let p = Math.min(1, (now - start) / duration);
        p = 1 - Math.pow(1 - p, 3); // easeOutCubic
        setVal(to * p);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && run()),
      { threshold: 0.5 }
    );
    io.observe(el);
    // fail-safe: never leave it stuck at 0
    const t = setTimeout(run, 1600);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, [to, duration]);

  return { ref, display: `${val.toFixed(decimals)}${suffix}` };
}
