'use client';

/**
 * The WebGL Living Earth. Loaded only through LivingEarth (next/dynamic,
 * ssr: false), so three.js never reaches the shared bundle or the server.
 *
 * Frame-loop discipline:
 *  - Nothing here sets React state per frame. Camera flight, idle orbit and
 *    cloud drift all mutate three.js objects inside useFrame.
 *  - The loop stops entirely (`frameloop="never"`) when the canvas is off
 *    screen or the tab is hidden — the parent passes `active`.
 *  - DPR, texture size and sphere detail come from earthQuality().
 */

import { Suspense, useEffect, useMemo, useRef, useState, type ElementRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Stars, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { latLonToVec3, vec3ToLatLon, slerpLatLon, easeInOutCubic, flightSeconds, type LatLon } from '@/lib/experience/geo';
import { subsolarPoint } from '@/lib/experience/sun';
import { COUNTRY_CO2, co2Color, co2Intensity, type CountryCo2 } from '@/lib/experience/co2';
import { EARTH_TEXTURES, type EarthQuality } from '@/lib/experience/quality';
import { earthVertex, earthFragment, cloudFragment, atmosphereVertex, atmosphereFragment } from './shaders';

export interface CameraTarget {
  at: LatLon;
  /** Distance from the centre, in globe radii. */
  distance: number;
}

export interface EarthCanvasProps {
  quality: EarthQuality;
  target: CameraTarget;
  /** Run the render loop. False when off screen or the tab is hidden. */
  active: boolean;
  /** Orbit + zoom by pointer. Off for passive hero use so touch scrolling is never captured. */
  interactive: boolean;
  showCo2: boolean;
  selectedIso: string | null;
  onSelectCountry?: (iso: string) => void;
  onReady?: () => void;
  onContextLost?: () => void;
}

export default function EarthCanvas(props: EarthCanvasProps) {
  const { quality, target, active, onContextLost } = props;
  const start = latLonToVec3(target.at, target.distance);

  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={quality.dpr}
      camera={{ fov: 35, near: 0.1, far: 200, position: start }}
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
      style={{ touchAction: props.interactive ? 'none' : 'pan-y' }}
    >
      <color attach="background" args={['#04080c']} />
      {quality.stars > 0 && <Stars radius={80} depth={40} count={quality.stars} factor={3.2} saturation={0} fade speed={0} />}
      <Suspense fallback={null}>
        <World {...props} />
      </Suspense>
      <CameraRig target={target} spin={quality.spin} interactive={props.interactive} />
    </Canvas>
  );
}

// ─── The globe ───────────────────────────────────────────────────────────────

function World({ quality, showCo2, selectedIso, onSelectCountry, onReady }: EarthCanvasProps) {
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

  const earthUniforms = useMemo(
    () => ({ dayMap: { value: day }, nightMap: { value: night }, waterMap: { value: water }, sunDir: { value: sunDir } }),
    [day, night, water, sunDir]
  );
  const cloudUniforms = useMemo(() => ({ cloudMap: { value: clouds }, sunDir: { value: sunDir }, opacity: { value: 0.88 } }), [clouds, sunDir]);
  const atmoUniforms = useMemo(() => ({ sunDir: { value: sunDir } }), [sunDir]);

  const cloudRef = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    // Cloud deck drifts against the surface. Decorative — the cloud map is a
    // static composite, and the credit line says so.
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.004;
  });

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  const seg = quality.segments;

  return (
    <group>
      <mesh
        // Stop pointer events here so markers on the far side never react.
        onPointerMove={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <sphereGeometry args={[1, seg, seg / 2]} />
        <shaderMaterial vertexShader={earthVertex} fragmentShader={earthFragment} uniforms={earthUniforms} />
      </mesh>

      {quality.clouds && (
        <mesh ref={cloudRef} raycast={() => null}>
          <sphereGeometry args={[1.008, seg, seg / 2]} />
          <shaderMaterial vertexShader={earthVertex} fragmentShader={cloudFragment} uniforms={cloudUniforms} transparent depthWrite={false} />
        </mesh>
      )}

      <mesh raycast={() => null} scale={1.06}>
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

      {showCo2 &&
        COUNTRY_CO2.map((c) => (
          <Co2Marker key={c.iso} c={c} selected={c.iso === selectedIso} onSelect={onSelectCountry} />
        ))}
    </group>
  );
}

// ─── Data markers ────────────────────────────────────────────────────────────

const UP = new THREE.Vector3(0, 1, 0);

function Co2Marker({ c, selected, onSelect }: { c: CountryCo2; selected: boolean; onSelect?: (iso: string) => void }) {
  const [hover, setHover] = useState(false);
  const intensity = co2Intensity(c.perCapita);
  const color = co2Color(intensity);
  const h = 0.025 + intensity * 0.16;

  const { position, quaternion } = useMemo(() => {
    const p = new THREE.Vector3(...latLonToVec3(c.at, 1.002));
    const q = new THREE.Quaternion().setFromUnitVectors(UP, p.clone().normalize());
    return { position: p, quaternion: q };
  }, [c.at]);

  const lit = hover || selected;

  return (
    <group position={position} quaternion={quaternion}>
      <mesh position={[0, h / 2, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.0042, 0.0042, h, 8]} />
        <meshBasicMaterial color={color} transparent opacity={lit ? 1 : 0.82} toneMapped={false} />
      </mesh>
      <mesh position={[0, h, 0]} raycast={() => null}>
        <sphereGeometry args={[lit ? 0.013 : 0.009, 12, 8]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
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
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(c.iso);
        }}
      >
        <cylinderGeometry args={[0.03, 0.03, h + 0.03, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {lit && (
        <Html position={[0, h + 0.03, 0]} center distanceFactor={4} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-[10px] border border-white/15 bg-[rgba(4,8,12,0.82)] px-3 py-2 text-white shadow-lg backdrop-blur-md">
            <div className="text-[13px] font-bold">{c.country}</div>
            <div className="font-mono text-[12px]" style={{ color }}>
              {c.perCapita.toFixed(1)} t CO₂ / person / yr
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Camera ──────────────────────────────────────────────────────────────────

/**
 * Flies the camera along the great circle to `target`, then idles in a slow
 * orbit. User drags (when interactive) pause the idle orbit until release.
 */
function CameraRig({ target, spin, interactive }: { target: CameraTarget; spin: number; interactive: boolean }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const controls = useRef<ElementRef<typeof OrbitControls>>(null);
  const flight = useRef<{ from: LatLon; fromD: number; to: LatLon; toD: number; t: number; dur: number } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const pos = camera.position.toArray() as [number, number, number];
    const from = vec3ToLatLon(pos);
    flight.current = {
      from,
      fromD: camera.position.length(),
      to: target.at,
      // Distances are tuned for a landscape frame. In a portrait frame the
      // horizontal field of view is the narrow one, so back off to keep the
      // globe's width in shot.
      toD: target.distance * (aspect < 1 ? 1 / aspect : 1),
      t: 0,
      dur: flightSeconds(from, target.at),
    };
  }, [camera, target.at, target.distance, aspect]);

  useFrame((_, dt) => {
    const f = flight.current;
    if (f) {
      f.t = Math.min(1, f.t + dt / f.dur);
      const k = easeInOutCubic(f.t);
      const ll = slerpLatLon(f.from, f.to, k);
      // Pull back slightly mid-flight so long hops read as travel, not a cut.
      const lift = Math.sin(Math.PI * k) * Math.min(0.6, f.dur * 0.18);
      const d = f.fromD + (f.toD - f.fromD) * k + lift;
      camera.position.set(...latLonToVec3(ll, d));
      camera.lookAt(0, 0, 0);
      if (f.t >= 1) flight.current = null;
    } else if (spin > 0 && !dragging.current) {
      // Idle orbit: rotate the camera around the polar axis.
      const p = camera.position;
      const a = spin * dt;
      const x = p.x * Math.cos(a) - p.z * Math.sin(a);
      const z = p.x * Math.sin(a) + p.z * Math.cos(a);
      p.set(x, p.y, z);
      camera.lookAt(0, 0, 0);
    }
    controls.current?.update();
  });

  if (!interactive) return null;
  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={0.6}
      minDistance={1.6}
      maxDistance={9}
      onStart={() => {
        dragging.current = true;
        flight.current = null;
      }}
      onEnd={() => {
        dragging.current = false;
      }}
    />
  );
}
