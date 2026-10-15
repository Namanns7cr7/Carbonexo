'use client';

/**
 * Shows generated media for a slot if it exists, otherwise the fallback.
 * Generated media carries a visible "AI-generated" label — it is illustration,
 * never a photograph of a real place or satellite data. Video only plays
 * above the `still` tier; at `still` the poster frame (or fallback) shows.
 */

import type { ReactNode } from 'react';
import { getMedia } from '@/lib/experience/media';
import { useMotionTier } from '@/lib/useMotionTier';

export function MediaSlot({ id, fallback, className = '' }: { id: string; fallback: ReactNode; className?: string }) {
  const media = getMedia(id);
  const tier = useMotionTier();
  if (!media) return <div className={className}>{fallback}</div>;

  const playVideo = media.kind === 'video' && tier !== 'still';

  return (
    <div className={`relative ${className}`}>
      {media.kind === 'image' || !playVideo ? (
        media.kind === 'image' || media.poster ? (
          // eslint-disable-next-line @next/next/no-img-element -- static local asset, sized by the slot
          <img src={media.kind === 'image' ? media.src : media.poster} alt={media.alt} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          fallback
        )
      ) : (
        <video
          src={media.src}
          poster={media.poster}
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          aria-label={media.alt}
        />
      )}
      <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] text-white/75 backdrop-blur">
        AI-generated illustration
      </span>
    </div>
  );
}
