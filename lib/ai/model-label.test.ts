import { describe, expect, it } from 'vitest';
import { modelLabel, OFFLINE_LIBRARY_PROVIDER } from './model-label';

describe('modelLabel', () => {
  it('names the Gemini model that actually answered', () => {
    expect(modelLabel('gemini', 'gemini-2.5-flash')).toBe('Gemini 2.5 Flash');
    expect(modelLabel('gemini', 'gemini-3-flash-preview')).toBe('Gemini 3 Flash (preview)');
    expect(modelLabel('gemini', 'gemini-2.5-pro')).toBe('Gemini 2.5 Pro');
    expect(modelLabel('gemini', 'gemini-2.5-flash-lite')).toBe('Gemini 2.5 Flash-Lite');
  });

  it('never attributes deterministic, failed or offline replies to Gemini', () => {
    expect(modelLabel('carbonexo-smalltalk', null)).toBe('EcoMind');
    expect(modelLabel('carbonexo-safe', null)).toBe('EcoMind');
    expect(modelLabel(undefined, undefined)).toBe('EcoMind');
    expect(modelLabel(OFFLINE_LIBRARY_PROVIDER, undefined)).toBe('EcoMind · offline library');
    expect(modelLabel('canned-fallback', 'gemini-2.5-flash-as-text')).not.toBe('Gemini 3 Flash');
  });
});
