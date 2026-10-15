import { describe, it, expect } from 'vitest';
import {
  resolveMotionTier,
  allowsWebGL,
  allowsAmbientMotion,
  scaleDuration,
  fadeUp,
  sceneEnter,
  revealInView,
  stagger,
  DURATION,
  EASE,
  SPRING,
} from './motion';

describe('resolveMotionTier', () => {
  it('honours a stated reduced-motion preference above everything else', () => {
    expect(
      resolveMotionTier({ prefersReducedMotion: true, deviceMemory: 32, cores: 16 })
    ).toBe('still');
  });

  it('falls back to still when WebGL is unavailable', () => {
    expect(resolveMotionTier({ webglUnavailable: true, deviceMemory: 32, cores: 16 })).toBe('still');
  });

  it('gives a capable device the full experience', () => {
    expect(resolveMotionTier({ deviceMemory: 8, cores: 12 })).toBe('full');
  });

  it('demotes low-memory devices to lite', () => {
    expect(resolveMotionTier({ deviceMemory: 4, cores: 12 })).toBe('lite');
  });

  it('demotes low-core devices to lite', () => {
    expect(resolveMotionTier({ deviceMemory: 16, cores: 4 })).toBe('lite');
  });

  // Regression guard: deviceMemory is Chromium-only. Treating "unknown" as
  // "weak" would silently strip the experience from every Safari and Firefox
  // desktop viewer.
  it('treats unknown capability on a fine pointer as capable', () => {
    expect(resolveMotionTier({ prefersReducedMotion: false })).toBe('full');
  });

  it('assumes a mid-range phone when a touch device reports no capability', () => {
    expect(resolveMotionTier({ coarsePointer: true })).toBe('lite');
  });

  it('still trusts explicit capability on a touch device', () => {
    expect(resolveMotionTier({ coarsePointer: true, deviceMemory: 8, cores: 8 })).toBe('full');
  });

  it('defaults to full with no signals at all', () => {
    expect(resolveMotionTier()).toBe('full');
  });

  it('does not treat a null preference as reduced', () => {
    expect(resolveMotionTier({ prefersReducedMotion: null, deviceMemory: 8, cores: 8 })).toBe('full');
  });
});

describe('tier capability gates', () => {
  it('permits WebGL only at full', () => {
    expect(allowsWebGL('full')).toBe(true);
    expect(allowsWebGL('lite')).toBe(false);
    expect(allowsWebGL('still')).toBe(false);
  });

  it('permits ambient looping motion everywhere except still', () => {
    expect(allowsAmbientMotion('full')).toBe(true);
    expect(allowsAmbientMotion('lite')).toBe(true);
    expect(allowsAmbientMotion('still')).toBe(false);
  });
});

describe('scaleDuration', () => {
  it('passes durations through at full', () => {
    expect(scaleDuration(0.62, 'full')).toBe(0.62);
  });

  it('shortens durations at lite', () => {
    expect(scaleDuration(1, 'lite')).toBe(0.75);
  });

  // Framer Motion can skip completion callbacks on a literal 0, which would
  // strand any sequence that waits on onAnimationComplete.
  it('collapses to near-zero but never exactly zero at still', () => {
    expect(scaleDuration(1.6, 'still')).toBe(0.001);
    expect(scaleDuration(1.6, 'still')).toBeGreaterThan(0);
  });
});

describe('fadeUp', () => {
  it('travels and respects delay at full', () => {
    const v = fadeUp('full', { delay: 0.2, distance: 30 });
    expect(v.initial).toEqual({ opacity: 0, y: 30 });
    expect(v.animate).toEqual({ opacity: 1, y: 0 });
    expect(v.transition.delay).toBe(0.2);
    expect(v.transition.duration).toBe(DURATION.lg);
  });

  it('removes travel and delay at still, keeping the opacity change', () => {
    const v = fadeUp('still', { delay: 0.5, distance: 30 });
    expect(v.initial).toEqual({ opacity: 0, y: 0 });
    expect(v.transition.delay).toBe(0);
    expect(v.transition.duration).toBe(0.001);
  });

  it('uses the house easing', () => {
    expect(fadeUp('full').transition.ease).toBe(EASE.out);
  });
});

describe('sceneEnter', () => {
  it('adds depth at full', () => {
    const v = sceneEnter('full');
    expect(v.initial).toEqual({ opacity: 0, y: 48, scale: 0.98 });
    expect(v.transition.ease).toBe(EASE.entrance);
  });

  it('removes transform entirely at still', () => {
    const v = sceneEnter('still', { delay: 1 });
    expect(v.initial).toEqual({ opacity: 0, y: 0, scale: 1 });
    expect(v.transition.delay).toBe(0);
  });
});

describe('revealInView', () => {
  it('keeps its starting offset at every tier, because initial is captured at mount', () => {
    expect(revealInView('still').initial).toEqual(revealInView('full').initial);
  });

  it('snaps instead of moving at still', () => {
    const v = revealInView('still', { delay: 0.4 });
    expect(v.transition.duration).toBeLessThan(0.01);
    expect(v.transition.delay).toBe(0);
  });

  it('plays once when the element enters the viewport', () => {
    const v = revealInView('full', { amount: 0.4 });
    expect(v.whileInView).toEqual({ opacity: 1, y: 0 });
    expect(v.viewport).toEqual({ once: true, amount: 0.4 });
  });
});

describe('stagger', () => {
  it('staggers children at full', () => {
    expect(stagger('full').animate.transition.staggerChildren).toBeCloseTo(0.07);
  });

  it('reveals children together at still', () => {
    expect(stagger('still').animate.transition.staggerChildren).toBe(0);
  });
});

describe('token shape', () => {
  it('orders durations monotonically', () => {
    const { xs, sm, md, lg, xl, scene } = DURATION;
    expect([xs, sm, md, lg, xl, scene]).toEqual([...[xs, sm, md, lg, xl, scene]].sort((a, b) => a - b));
  });

  it('gives the world spring real mass so a planet does not feel weightless', () => {
    expect(SPRING.world.mass).toBeGreaterThan(SPRING.snappy.mass);
    expect(SPRING.world.stiffness).toBeLessThan(SPRING.snappy.stiffness);
  });

  it('expresses every easing as four cubic-bezier control points', () => {
    for (const curve of Object.values(EASE)) {
      expect(curve).toHaveLength(4);
    }
  });
});
