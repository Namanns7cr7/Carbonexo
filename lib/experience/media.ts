/**
 * Generated-media registry. Slots are filled by
 * scripts/experience/generate-media.mjs; until then they are empty and every
 * consumer renders its own real-time or CSS fallback. Generated media is
 * always labelled as AI-generated where it appears.
 */

import manifest from './generated-media.json';

export interface GeneratedMedia {
  src: string;
  kind: 'image' | 'video';
  alt: string;
  model: string;
  prompt: string;
  generatedAt: string;
  /** Still frame for a video slot, if one was produced. */
  poster?: string;
}

const slots = (manifest as { slots: Record<string, GeneratedMedia> }).slots;

export function getMedia(id: string): GeneratedMedia | null {
  return slots[id] ?? null;
}
