'use client';

/**
 * The WebGL Living Earth. Loaded only through LivingEarth (next/dynamic,
 * ssr: false), so three.js never reaches the shared bundle or the server.
 *
 * Motion is physical, not tweened: the camera is a GlobeBody
 * (lib/physics/globe.ts) — springs toward whatever the page asks it to look
 * at, follows the pointer on drag, glides on release with friction. The page
 * steers it by writing to `anchorRef`, which is read every frame, so scroll
 * can drive the camera without a single React render.
 *
 * Frame-loop discipline:
 *  - Nothing here sets React state per frame.
 *  - The loop stops entirely (`frameloop="never"`) when the canvas is off
 *    screen or the tab is hidden — the parent passes `active`.
 *  - DPR, texture size and sphere detail come from earthQuality().
 */

import { Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { latLonToVec3, slerpLatLon, angularDistance, type LatLon } from '@/lib/experience/geo';
import { subsolarPoint } from '@/lib/experience/sun';
import { COUNTRY_CO2, co2Color, co2Intensity } from '@/lib/experience/co2';
import { GRID_INTENSITY, gridColor, gridIntensity01 } from '@/lib/experience/grid';
import { EARTH_TEXTURES, type EarthQuality } from '@/lib/experience/quality';
import { GlobeBody, type GlobeAnchor } from '@/lib/physics/globe';
import { SPRINGS, stepSpring } from '@/lib/physics/spring';
import { earthVertex, earthFragment, cloudFragment, atmosphereVertex, atmosphereFragment } from './shaders';

export type EarthLayer = 'none' | 'co2' | 'grid';

/** A route drawn on the globe — great-circle arc with a traveller moving along it. */
export interface RouteArc {
  key: string;
  from: LatLon;
  to: LatLon;
  color: string;
  /** Traveller speed along the arc, laps per second. */
  pace?: number;
}

export interface EarthCanvasProps {
  quality: EarthQuality;
  /** Read every frame. Write to `.current` to steer the camera; change `key` for a new intent. */
  anchorRef: MutableRefObject<GlobeAnchor>;
  /** Exposes the physics body for keyboard / button controls. */
  bodyRef?: MutableRefObject<GlobeBody | null>;
  /** Run the render loop. False when off screen or the tab is hidden. */
  active: boolean;
  /** Drag to spin. On touch, only horizontal drags are taken; vertical stays page scroll unless `zoomable`. */
  interactive: boolean;
  /** Wheel and pinch zoom. Only where the globe owns the gesture — never behind scrolling copy. */
  zoomable: boolean;
  layer: EarthLayer;
  selectedIso: string | null;
  onSelectCountry?: (iso: string) => void;
  route?: RouteArc | null;
  onReady?: () => void;
  onContextLost?: () => void;
  /**
   * Living World health, 0 (degraded) … 1 (lush). Read every frame and
   * spring-smoothed, so a page can write to it on scroll or on new data
   * without re-rendering. See lib/living-world.
   */
  vitalityRef?: MutableRefObject<number>;
  /** Clear colour behind the planet, so a compact globe sits flush on its card. */
  background?: string;
}

const FOV = 35;

export default function EarthCanvas(props: EarthCanvasProps) {
  const { quality, onContextLost, anchorRef } = props;
  const a = anchorRef.current;
  const start = latLonToVec3({ lat: a.lat, lon: a.lon }, a.dist);

  return (
    <Canvas
      frameloop={props.active ? 'always' : 'never'}
      dpr={quality.dpr}
      camera={{ fov: FOV, near: 0.1, far: 200, position: start }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          onContextLost?.();
        });
      }}
      style={{ touchAction: props.zoomable ? 'none' : 'pan-y', cursor: props.interactive ? 'grab' : undefined }}
    >
      <color attach="background" args={[props.background ?? '#030709']} />
      {quality.stars > 0 && <Stars radius={80} depth={40} count={quality.stars} factor={3.2} saturation={0} fade speed={0} />}
      <Suspense fallback={null}>
        <World {...props} />
      </Suspense>
      <PhysicsRig {...props} />
    </Canvas>
  );
}

// ─── The globe ───────────────────────────────────────────────────────────────

function World({ quality, layer, selectedIso, onSelectCountry, route, onReady, vitalityRef }: EarthCanvasProps) {
  const tex = EARTH_TEXTURES[quality.texture];
  const [day, night, water, clouds] = useTexture([tex.day, tex.night, EARTH_TEXTURES.water, EARTH_TEXTURES.clouds]);

  useMemo(() => {
    day.colorSpace = THREE.SRGBColorSpace;
    night.colorSpace = THREE.SRGBColorSpace;
    for (const t of [day, night, water, clouds]) t.anisotropy = 8;
  }, [day, night, water, clouds]);

  // Real sun direction, refreshed every minute — the terminator creeps ~0.25°/min.
  const sunDir = useMemo(() => new THREE.Vector3(...latLonToVec3(subsolarPoint())), []);
  useEffect(() => {
    const id = window.setInterval(() => sunDir.set(...latLonToVec3(subsolarPoint())), 60_000);
    return () => window.clearInterval(id);
  }, [sunDir]);

  // One shared uniform object, so the surface and the atmosphere always agree.
  const vitality = useMemo(() => ({ value: vitalityRef?.current ?? 0.5 }), [vitalityRef]);
  const earthUniforms = useMemo(
    () => ({ dayMap: { value: day }, nightMap: { value: night }, waterMap: { value: water }, sunDir: { value: sunDir }, vitality }),
    [day, night, water, sunDir, vitality]
  );
  const cloudUniforms = useMemo(() => ({ cloudMap: { value: clouds }, sunDir: { value: sunDir }, opacity: { value: 0.85 } }), [clouds, sunDir]);
  const atmoUniforms = useMemo(() => ({ sunDir: { value: sunDir }, vitality }), [sunDir, vitality]);

  const cloudRef = useRef<THREE.Mesh>(null);
  const vSpring = useRef({ x: vitality.value, v: 0 });
  useFrame((_, dt) => {
    // Cloud deck drifts against the surface. Decorative — the cloud map is a static composite.
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.004;
    // Health changes are physical too: the planet eases into its new state, it never snaps.
    const target = vitalityRef?.current ?? 0.5;
    stepSpring(vSpring.current, target, SPRINGS.health, dt);
    vitality.value = Math.max(0, Math.min(1, vSpring.current.x));
  });

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  const seg = quality.segments;
  const markers = useMemo(() => {
    if (layer === 'co2')
      return COUNTRY_CO2.map((c) => {
        const t = co2Intensity(c.perCapita);
        return { iso: c.iso, at: c.at, t, color: co2Color(t), title: c.country, value: `${c.perCapita.toFixed(1)} t CO₂ / person / yr` };
      });
    if (layer === 'grid')
      return COUNTRY_CO2.filter((c) => GRID_INTENSITY[c.iso]).map((c) => {
        const g = GRID_INTENSITY[c.iso];
        const t = gridIntensity01(g.g);
        return { iso: c.iso, at: c.at, t, color: gridColor(t), title: c.country, value: `${g.g} g CO₂e / kWh (${g.year})` };
      });
    return [];
  }, [layer]);

  return (
    <group>
      <mesh onPointerMove={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <sphereGeometry args={[1, seg, seg / 2]} />
        <shaderMaterial vertexShader={earthVertex} fragmentShader={earthFragment} uniforms={earthUniforms} />
      </mesh>

      {quality.clouds && (
        <mesh ref={cloudRef} raycast={() => null}>
          <sphereGeometry args={[1.008, seg, seg / 2]} />
          <shaderMaterial vertexShader={earthVertex} fragmentShader={cloudFragment} uniforms={cloudUniforms} transparent depthWrite={false} />
        </mesh>
      )}

      <mesh raycast={() => null} scale={1.1}>
        <sphereGeometry args={[1, 64, 32]} />
        <shaderMaterial
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          uniforms={atmoUniforms}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>

      {markers.map((m) => (
        <DataMarker key={`${layer}-${m.iso}`} {...m} selected={m.iso === selectedIso} onSelect={onSelectCountry} />
      ))}

      {route && <Route key={route.key} route={route} />}
    </group>
  );
}

// ─── Data markers ────────────────────────────────────────────────────────────

const UP = new THREE.Vector3(0, 1, 0);

interface MarkerProps {
  iso: string;
  at: LatLon;
  /** 0…1 — drives height. */
  t: number;
  color: string;
  title: string;
  value: string;
  selected: boolean;
  onSelect?: (iso: string) => void;
}

/**
 * A spike that grows out of the surface on a spring when the layer appears,
 * so switching layers reads as the planet answering rather than a redraw.
 */
function DataMarker({ iso, at, t, color, title, value, selected, onSelect }: MarkerProps) {
  const [hover, setHover] = useState(false);
  const h = 0.025 + t * 0.16;
  const grow = useRef({ x: 0, v: 0 });
  const stem = useRef<THREE.Group>(null);
  // Stagger by longitude so a layer sweeps across the globe instead of popping.
  const delay = useRef(((at.lon + 180) / 360) * 0.5);

  const { position, quaternion } = useMemo(() => {
    const p = new THREE.Vector3(...latLonToVec3(at, 1.002));
    const q = new THREE.Quaternion().setFromUnitVectors(UP, p.clone().normalize());
    return { position: p, quaternion: q };
  }, [at]);

  useFrame((_, dt) => {
    if (delay.current > 0) {
      delay.current -= dt;
      return;
    }
    stepSpring(grow.current, 1, SPRINGS.zoom, dt);
    if (stem.current) stem.current.scale.set(1, Math.max(0.001, grow.current.x), 1);
  });

  const lit = hover || selected;

  return (
    <group position={position} quaternion={quaternion}>
      <group ref={stem} scale={[1, 0.001, 1]}>
        <mesh position={[0, h / 2, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.0042, 0.0042, h, 8]} />
          <meshBasicMaterial color={color} transparent opacity={lit ? 1 : 0.82} toneMapped={false} />
        </mesh>
        <mesh position={[0, h, 0]} raycast={() => null}>
          <sphereGeometry args={[lit ? 0.013 : 0.009, 12, 8]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      </group>
      {/* Generous invisible hit target — the visible spike is too thin to click. */}
      <mesh
        position={[0, h / 2, 0]}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = '';
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta > 6) return; // that was a drag, not a click
          onSelect?.(iso);
        }}
      >
        <cylinderGeometry args={[0.03, 0.03, h + 0.03, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {lit && (
        <Html position={[0, h + 0.03, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none", transform: "translateY(-28px)" }}>
          <div className="whitespace-nowrap rounded-[10px] border border-white/15 bg-[rgba(4,10,8,0.86)] px-3 py-2 text-white shadow-lg">
            <div className="text-[13px] font-bold">{title}</div>
            <div className="font-mono text-[12px]" style={{ color }}>
              {value}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Routes ──────────────────────────────────────────────────────────────────

const ARC_POINTS = 96;

/** Point on the arc at t ∈ [0,1], lifted off the surface proportionally to the arc length. */
function arcPoint(from: LatLon, to: LatLon, t: number, lift: number): THREE.Vector3 {
  const ll = slerpLatLon(from, to, t);
  return new THREE.Vector3(...latLonToVec3(ll, 1.004 + lift * Math.sin(Math.PI * t)));
}

function Route({ route }: { route: RouteArc }) {
  const lift = useMemo(() => 0.015 + 0.22 * (angularDistance(route.from, route.to) / 180), [route.from, route.to]);
  const geometry = useMemo(() => {
    const pts = Array.from({ length: ARC_POINTS + 1 }, (_, i) => arcPoint(route.from, route.to, i / ARC_POINTS, lift));
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    g.setDrawRange(0, 0);
    return g;
  }, [route.from, route.to, lift]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const line = useMemo(
    () => new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: route.color, transparent: true, opacity: 0.95, toneMapped: false })),
    [geometry, route.color]
  );
  useEffect(() => () => (line.material as THREE.Material).dispose(), [line]);

  const draw = useRef({ x: 0, v: 0 });
  const traveller = useRef<THREE.Mesh>(null);
  const lap = useRef(0);

  useFrame((_, dt) => {
    // The arc draws itself on a spring, then a traveller runs along it on loop.
    stepSpring(draw.current, 1, SPRINGS.camera, dt);
    const d = Math.max(0, Math.min(1, draw.current.x));
    geometry.setDrawRange(0, Math.ceil(d * ARC_POINTS) + 1);
    if (traveller.current) {
      if (d > 0.98) lap.current = (lap.current + dt * (route.pace ?? 0.28)) % 1;
      else lap.current = d;
      // Ease in/out per lap: departs and arrives slowly, like a vehicle.
      const k = lap.current;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      traveller.current.position.copy(arcPoint(route.from, route.to, e, lift));
    }
  });

  const fromP = useMemo(() => new THREE.Vector3(...latLonToVec3(route.from, 1.004)), [route.from]);
  const toP = useMemo(() => new THREE.Vector3(...latLonToVec3(route.to, 1.004)), [route.to]);

  return (
    <group>
      <primitive object={line} />
      {[fromP, toP].map((p, i) => (
        <mesh key={i} position={p} raycast={() => null}>
          <sphereGeometry args={[0.009, 12, 8]} />
          <meshBasicMaterial color={route.color} toneMapped={false} />
        </mesh>
      ))}
      <mesh ref={traveller} raycast={() => null}>
        <sphereGeometry args={[0.012, 16, 12]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  );
}

// ─── Camera ──────────────────────────────────────────────────────────────────

/**
 * Binds a GlobeBody to the camera and to pointer input on the canvas.
 *
 * Pointer handling is done on the DOM element rather than through R3F events
 * so a drag that starts on empty space (or a marker) is still a drag, and so
 * touch can split by axis: horizontal = spin, vertical = page scroll.
 */
function PhysicsRig({ anchorRef, bodyRef, interactive, zoomable }: EarthCanvasProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const body = useMemo(() => new GlobeBody(anchorRef.current), [anchorRef]);
  const lastFrame = useRef(NaN);

  useEffect(() => {
    if (bodyRef) bodyRef.current = body;
    return () => {
      if (bodyRef) bodyRef.current = null;
    };
  }, [body, bodyRef]);

  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let last = { x: 0, y: 0, t: 0 };
    let pinch0 = 0;

    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        body.beginDrag(e.timeStamp);
        last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
        el.style.cursor = 'grabbing';
      } else if (pointers.size === 2 && zoomable) {
        const [p, q] = Array.from(pointers.values());
        pinch0 = Math.hypot(p.x - q.x, p.y - q.y);
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && zoomable) {
        const [p, q] = Array.from(pointers.values());
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (pinch0 > 0 && d > 0) body.zoomBy(pinch0 / d);
        pinch0 = d;
        return;
      }
      const dt = Math.max(0.001, (e.timeStamp - last.t) / 1000);
      // On touch without zoom, the browser owns vertical motion (pan-y); only spin horizontally.
      const dy = e.pointerType === 'touch' && !zoomable ? 0 : e.clientY - last.y;
      body.drag(e.clientX - last.x, dy, dt, el.clientHeight, FOV, e.timeStamp);
      last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    };
    const up = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      if (pointers.size === 0) {
        body.endDrag(e.timeStamp);
        el.style.cursor = 'grab';
      } else {
        const p = Array.from(pointers.values())[0];
        last = { x: p.x, y: p.y, t: e.timeStamp };
      }
    };
    const wheel = (e: WheelEvent) => {
      if (!zoomable) return;
      e.preventDefault();
      body.zoomBy(Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.0022));
    };

    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl, body, interactive, zoomable]);

  useFrame((_, dt) => {
    body.setAnchor(anchorRef.current);
    body.step(dt);
    const { lat, lon } = body.latLon();
    camera.position.set(...latLonToVec3({ lat, lon }, body.distS.x));
    camera.lookAt(0, 0, 0);

    // Horizontal framing through the projection, not the camera position,
    // so the planet slides across the frame without changing perspective.
    const fx = Math.round(body.frameS.x * 1000) / 1000;
    const fy = Math.round(body.frameYS.x * 1000) / 1000;
    const sig = fx * 7919 + fy;
    if (sig !== lastFrame.current) {
      lastFrame.current = sig;
      if (fx === 0 && fy === 0) camera.clearViewOffset();
      else camera.setViewOffset(size.width, size.height, -fx * size.width, fy * size.height, size.width, size.height);
    }
  });

  // Resize invalidates the view offset.
  useEffect(() => {
    lastFrame.current = NaN;
  }, [size.width, size.height]);

  return null;
}
