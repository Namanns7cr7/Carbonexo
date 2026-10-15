'use client';

/**
 * A small rotating Earth, built with two duplicated copies of a real NASA
 * Blue Marble world-map texture (public/images/earth-texture.jpg, public
 * domain) scrolling seamlessly inside a circular porthole — the classic
 * lightweight "rotating globe" technique, no WebGL/3D library needed.
 * `transform: translateX(-50%)` on a flex row containing two copies of the
 * (equal-width) image always moves exactly one image-width regardless of
 * actual rendered pixel size, so the loop is seamless at any `size`.
 */
export function RotatingGlobe({ size = 120 }: { size?: number }) {
  return (
    <div
      className="relative flex-shrink-0 overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        boxShadow:
          '0 8px 24px -6px rgba(0,0,0,0.35), inset -10px -10px 22px rgba(0,0,0,0.3), inset 8px 8px 18px rgba(255,255,255,0.12)',
      }}
    >
      <div className="globe-spin absolute inset-0 flex h-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/earth-texture.jpg" alt="" className="h-full w-auto flex-shrink-0 select-none" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/earth-texture.jpg" alt="" className="h-full w-auto flex-shrink-0 select-none" draggable={false} aria-hidden />
      </div>
      {/* sphere shading: soft highlight top-left, shadow bottom-right, to sell the 3D curvature */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.3), transparent 50%), radial-gradient(circle at 68% 78%, rgba(0,0,0,0.4), transparent 60%)',
        }}
      />
      <style jsx>{`
        .globe-spin {
          animation: globe-rotate 16s linear infinite;
        }
        @keyframes globe-rotate {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
