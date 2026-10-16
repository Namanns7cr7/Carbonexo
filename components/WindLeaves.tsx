'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from '@/lib/theme-provider';

/**
 * Ghibli-style wind: scrolling builds up energy and releases gusts —
 * a flurry of leaves swept LEFT→RIGHT across the screen in swirling,
 * rotating paths, plus faint wind streaks. A faint idle breeze keeps a
 * stray leaf drifting when still. Theme-aware (glows in dark).
 *
 * Uses the Web Animations API directly (cheap, GPU-friendly) rather than
 * mounting hundreds of React nodes. Honors prefers-reduced-motion.
 */
export function WindLeaves() {
  const layerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const colors = () =>
      themeRef.current === 'dark'
        ? ['#a3e635', '#84cc16', '#bef264', '#5fd3e8', '#65a30d']
        : ['#84cc16', '#65a30d', '#a3cf5b', '#4d9c5b', '#7fb84a'];

    const windLeaf = () => {
      if (layer.childElementCount > 50) return;
      const leaf = document.createElement('div');
      const size = 8 + Math.random() * 14;
      const c = colors()[Math.floor(Math.random() * 5)];
      const glow = themeRef.current === 'dark' ? `;box-shadow:0 0 10px ${c}55` : '';
      leaf.style.cssText = `position:absolute;top:${Math.random() * 100}%;left:0;width:${size}px;height:${size * 1.35}px;background:linear-gradient(135deg,${c},${c}88);border-radius:0 100% 0 100%;opacity:0;will-change:transform${glow}`;
      layer.appendChild(leaf);
      const dur = 2400 + Math.random() * 2600;
      const rot = Math.random() * 360;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const amp = 30 + Math.random() * 90;
      const drop = -20 + Math.random() * 160;
      const spin = (2 + Math.random() * 3) * 360 * (Math.random() < 0.5 ? 1 : -1);
      const a = leaf.animate(
        [
          { transform: `translate(-12vw,0) rotate(${rot}deg)`, opacity: 0 },
          { opacity: 0.9, offset: 0.08 },
          { transform: `translate(24vw,${dir * -amp + drop * 0.2}px) rotate(${rot + spin * 0.24}deg)`, offset: 0.3 },
          { transform: `translate(54vw,${dir * amp + drop * 0.55}px) rotate(${rot + spin * 0.55}deg)`, offset: 0.58 },
          { transform: `translate(82vw,${dir * -amp * 0.6 + drop * 0.8}px) rotate(${rot + spin * 0.8}deg)`, offset: 0.82 },
          { opacity: 0.75, offset: 0.9 },
          { transform: `translate(120vw,${dir * amp * 0.5 + drop}px) rotate(${rot + spin}deg)`, opacity: 0 },
        ],
        { duration: dur, easing: 'cubic-bezier(.32,.12,.36,1)' }
      );
      a.onfinish = () => leaf.remove();
    };

    const windStreak = () => {
      const s = document.createElement('div');
      const isDark = themeRef.current === 'dark';
      const c = isDark ? 'rgba(163,230,53,0.16)' : 'rgba(132,204,22,0.13)';
      s.style.cssText = `position:absolute;top:${Math.random() * 100}%;left:0;height:1.5px;width:${140 + Math.random() * 240}px;background:linear-gradient(90deg,transparent,${c},transparent);border-radius:2px;opacity:0;will-change:transform;filter:blur(.6px)`;
      layer.appendChild(s);
      const a = s.animate(
        [
          { transform: 'translate(-25vw,0)', opacity: 0 },
          { opacity: 0.9, offset: 0.3 },
          { transform: `translate(125vw,${Math.random() * 50 - 16}px)`, opacity: 0 },
        ],
        { duration: 700 + Math.random() * 500, easing: 'cubic-bezier(.2,.6,.3,1)' }
      );
      a.onfinish = () => s.remove();
    };

    const gust = (strength: number) => {
      const count = 4 + Math.floor(Math.random() * 4 + strength * 4);
      for (let i = 0; i < count; i++) setTimeout(windLeaf, i * 55 + Math.random() * 140);
      windStreak();
      setTimeout(windStreak, 120 + Math.random() * 160);
    };

    let lastY = window.scrollY, acc = 0, cooldown = 0;
    const onScroll = () => {
      const y = window.scrollY;
      acc += Math.abs(y - lastY);
      lastY = y;
      const now = performance.now();
      if (acc > 130 && now - cooldown > 160) {
        gust(Math.min(2.2, Math.abs(y - lastY) / 36 || 1));
        acc = 0;
        cooldown = now;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const breeze = setInterval(() => {
      if (!document.hidden && layer.childElementCount < 5 && Math.random() < 0.45) windLeaf();
    }, 2800);

    return () => {
      window.removeEventListener('scroll', onScroll);
      clearInterval(breeze);
    };
  }, []);

  return <div ref={layerRef} className="pointer-events-none fixed inset-0 z-[6] overflow-hidden" aria-hidden />;
}
