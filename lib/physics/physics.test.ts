import { describe, expect, it } from 'vitest';
import { SPRINGS, decay, dampingFor, nearestAngle, rubberBand, spring, stepSpring, wrapAngle } from './spring';
import { GlobeBody, type GlobeAnchor } from './globe';

const DEG = Math.PI / 180;

function run(steps: number, dt: number, fn: () => void) {
  for (let i = 0; i < steps; i++) fn();
  return steps * dt;
}

describe('stepSpring', () => {
  it('converges to the target', () => {
    const s = { x: 0, v: 0 };
    run(240, 1 / 60, () => stepSpring(s, 10, SPRINGS.camera, 1 / 60));
    expect(s.x).toBeCloseTo(10, 2);
    expect(Math.abs(s.v)).toBeLessThan(0.01);
  });

  it('critically damped never overshoots', () => {
    const s = { x: 0, v: 0 };
    let max = 0;
    run(600, 1 / 60, () => {
      stepSpring(s, 1, spring(30, 1), 1 / 60);
      max = Math.max(max, s.x);
    });
    expect(max).toBeLessThanOrEqual(1 + 1e-6);
  });

  it('the camera preset overshoots by only a hair — mass, not wobble', () => {
    const s = { x: 0, v: 0 };
    let max = 0;
    run(600, 1 / 60, () => {
      stepSpring(s, 1, SPRINGS.camera, 1 / 60);
      max = Math.max(max, s.x);
    });
    expect(max).toBeGreaterThan(1);
    expect(max).toBeLessThan(1.01);
  });

  it('is stable after a long stall (huge dt is clamped and sub-stepped)', () => {
    const s = { x: 0, v: 0 };
    stepSpring(s, 1, spring(400, 0.5), 5);
    expect(Number.isFinite(s.x)).toBe(true);
    expect(Math.abs(s.x)).toBeLessThan(3);
  });

  it('carries existing velocity into a retarget instead of restarting', () => {
    const s = { x: 0, v: 5 };
    stepSpring(s, 0, SPRINGS.camera, 1 / 60);
    expect(s.x).toBeGreaterThan(0); // keeps moving forward before the spring wins
  });

  it('dampingFor gives 2·ζ·√(k·m)', () => {
    expect(dampingFor(16, 1)).toBe(8);
    expect(dampingFor(16, 0.5, 4)).toBe(8);
  });
});

describe('angles and limits', () => {
  it('wraps to (−π, π]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(0.5)).toBeCloseTo(0.5);
    expect(wrapAngle(-7)).toBeCloseTo(-7 + 2 * Math.PI);
  });

  it('nearestAngle takes the short way across the antimeridian', () => {
    const t = nearestAngle(170 * DEG, -170 * DEG);
    expect(t / DEG).toBeCloseTo(190);
  });

  it('rubberBand is free inside, monotonic and bounded outside', () => {
    expect(rubberBand(5, 0, 10, 2)).toBe(5);
    const a = rubberBand(11, 0, 10, 2);
    const b = rubberBand(20, 0, 10, 2);
    const c = rubberBand(1e6, 0, 10, 2);
    expect(a).toBeGreaterThan(10);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeLessThan(12);
    expect(rubberBand(-1e6, 0, 10, 2)).toBeGreaterThan(-2);
  });

  it('decay is frame-rate independent', () => {
    let a = 1;
    for (let i = 0; i < 60; i++) a = decay(a, 2, 1 / 60);
    let b = 1;
    for (let i = 0; i < 30; i++) b = decay(b, 2, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
    expect(a).toBeCloseTo(Math.exp(-2), 6);
  });
});

describe('GlobeBody', () => {
  const home: GlobeAnchor = { key: 'home', lat: 10, lon: 20, dist: 4 };
  const dt = 1 / 60;
  const fling = (g: GlobeBody, dxPerFrame: number, frames = 6) => {
    let t = 0;
    g.beginDrag(t);
    for (let i = 0; i < frames; i++) {
      t += dt * 1000;
      g.drag(dxPerFrame, 0, dt, 900, 35, t);
    }
    g.endDrag(t + 5);
  };

  it('follows a new anchor and settles on it', () => {
    const g = new GlobeBody(home);
    g.setAnchor({ key: 'amazon', lat: -3, lon: -62, dist: 3.6 });
    run(600, dt, () => g.step(dt));
    expect(g.latLon().lat).toBeCloseTo(-3, 1);
    expect(g.latLon().lon).toBeCloseTo(-62, 1);
    expect(g.distS.x).toBeCloseTo(3.6, 2);
  });

  it('flies the short way across the antimeridian', () => {
    const g = new GlobeBody({ key: 'a', lat: 0, lon: 170, dist: 4 });
    g.setAnchor({ key: 'b', lat: 0, lon: -170, dist: 4 });
    for (let i = 0; i < 30; i++) g.step(dt);
    const lon = g.latLon().lon;
    // Moving east through 180, never back west through 0.
    expect(lon > 170 || lon < -169).toBe(true);
  });

  it('pulls the camera back mid-flight on a long hop, then lands at the anchor distance', () => {
    const g = new GlobeBody({ key: 'a', lat: 0, lon: 0, dist: 4 });
    g.setAnchor({ key: 'b', lat: 0, lon: 150, dist: 4 });
    let peak = 0;
    run(600, dt, () => {
      g.step(dt);
      peak = Math.max(peak, g.distS.x);
    });
    expect(peak).toBeGreaterThan(4.2);
    expect(g.distS.x).toBeCloseTo(4, 2);
  });

  it('a fling glides on, then friction brings it down to the anchor drift', () => {
    const g = new GlobeBody({ ...home, drift: 3 });
    fling(g, -40);
    expect(g.mode).toBe('free');
    const v0 = g.vLon;
    expect(Math.abs(v0)).toBeGreaterThan(0.3);
    const lon0 = g.lon;
    g.step(dt);
    expect(Math.sign(g.lon - lon0)).toBe(Math.sign(v0)); // momentum carries
    run(600, dt, () => g.step(dt));
    expect(g.vLon).toBeCloseTo(3 * DEG, 3); // wound back up to idle drift
  });

  it('dragging moves the surface with the pointer (drag right → camera west)', () => {
    const g = new GlobeBody(home);
    const before = g.lon;
    g.beginDrag(0);
    g.drag(50, 0, dt, 900, 35, 16);
    expect(g.lon).toBeLessThan(before);
  });

  it('releasing after holding still does not throw the planet', () => {
    const g = new GlobeBody(home);
    g.beginDrag(0);
    g.drag(-40, 0, dt, 900, 35, 16);
    g.endDrag(400);
    expect(g.vLon).toBe(0);
  });

  it('a user-chosen view is kept until the anchor key changes', () => {
    const g = new GlobeBody(home);
    fling(g, -40);
    run(600, dt, () => g.step(dt));
    const resting = g.latLon().lon;
    g.setAnchor({ ...home, lon: 25 }); // same key, moved target — stay free
    run(120, dt, () => g.step(dt));
    expect(g.mode).toBe('free');
    expect(g.latLon().lon).toBeCloseTo(resting, 3);
    g.setAnchor({ ...home, key: 'next' });
    expect(g.mode).toBe('follow');
  });

  it('zoom is clamped to the limits', () => {
    const g = new GlobeBody(home);
    for (let i = 0; i < 50; i++) g.zoomBy(0.5);
    run(600, dt, () => g.step(dt));
    expect(g.distS.x).toBeGreaterThanOrEqual(g.limits.minDist - 1e-3);
    for (let i = 0; i < 50; i++) g.zoomBy(2);
    run(600, dt, () => g.step(dt));
    expect(g.distS.x).toBeLessThanOrEqual(g.limits.maxDist + 1e-3);
  });

  it('latitude dragged past the limit springs back inside it', () => {
    const g = new GlobeBody(home);
    g.beginDrag(0);
    for (let i = 0; i < 200; i++) g.drag(0, 60, dt, 900, 35, i * 16);
    expect(g.latLon().lat).toBeGreaterThan(78);
    g.endDrag(10_000);
    run(300, dt, () => g.step(dt));
    expect(g.latLon().lat).toBeLessThanOrEqual(78.01);
  });

  it('keyboard nudge imparts momentum', () => {
    const g = new GlobeBody(home);
    g.nudge(1, 0);
    const before = g.lon;
    run(30, dt, () => g.step(dt));
    expect(g.lon).toBeGreaterThan(before);
  });
});
