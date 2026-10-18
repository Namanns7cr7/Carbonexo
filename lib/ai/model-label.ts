/**
 * The label shown on a coach reply, derived only from what the backend says produced it.
 * Never claims a model that did not answer: small talk, unanswered turns and unknown
 * providers are "EcoMind"; the built-in reference library is labelled as offline.
 */
export const OFFLINE_LIBRARY_PROVIDER = 'Reference library (offline)';

export function modelLabel(provider?: string | null, model?: string | null): string {
  if (provider === OFFLINE_LIBRARY_PROVIDER) return 'EcoMind · offline library';
  const m = (model ?? '').toLowerCase();
  const g = /^gemini-(\d+(?:\.\d+)?)-(flash-lite|flash|pro)/.exec(m);
  if (g) {
    const tier = g[2] === 'flash-lite' ? 'Flash-Lite' : g[2] === 'pro' ? 'Pro' : 'Flash';
    return `Gemini ${g[1]} ${tier}${m.includes('preview') ? ' (preview)' : ''}`;
  }
  return 'EcoMind';
}
