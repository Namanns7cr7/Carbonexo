'use client';

import { useEffect, useState } from 'react';
import { resolveMotionTier, type MotionTier } from './motion';

/**
 * Measures the viewer's motion preference and device capability, and resolves
 * them to a MotionTier.
 *
 * Starts at `still` and upgrades after mount, on purpose:
 *
 *  - It is the safe default. A viewer who asked for reduced motion must never
 *    see a frame of movement before the preference is read.
 *  - The server has no access to either signal, so anything else would
 *    hydrate-mismatch.
 *
 * Scenes therefore render their static composition first and animate in once
 * the tier settles, which is also the behaviour the first paint should have.
 */
export function useMotionTier(): MotionTier {
  const [tier, setTier] = useState<MotionTier>('still');

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointerQuery = window.matchMedia('(pointer: coarse)');

    const nav = navigator as Navigator & { deviceMemory?: number };

    const measure = () =>
      setTier(
        resolveMotionTier({
          prefersReducedMotion: motionQuery.matches,
          deviceMemory: nav.deviceMemory,
          cores: nav.hardwareConcurrency,
          webglUnavailable: !hasWebGL(),
          coarsePointer: pointerQuery.matches,
        })
      );

    measure();
    motionQuery.addEventListener('change', measure);
    return () => motionQuery.removeEventListener('change', measure);
  }, []);

  return tier;
}

/**
 * One-shot WebGL probe. Cached, because creating a throwaway context is not
 * free and the answer cannot change within a page lifetime.
 *
 * The context is explicitly released: browsers cap simultaneous WebGL contexts
 * (often ~16), and leaking probe contexts can starve the real scene.
 */
let webglSupport: boolean | null = null;

export function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ||
      canvas.getContext('webgl')) as WebGLRenderingContext | null;

    if (!gl) {
      webglSupport = false;
      return false;
    }

    gl.getExtension('WEBGL_lose_context')?.loseContext();
    webglSupport = true;
  } catch {
    webglSupport = false;
  }

  return webglSupport;
}
