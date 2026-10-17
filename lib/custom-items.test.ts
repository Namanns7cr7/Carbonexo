import { describe, expect, it } from 'vitest';
import { MAX_CUSTOM_ITEMS, estimateKg, isCustom, parseStored, toCustomItem, toTrackOption, upsert, validateDraft, type CustomDraft } from './custom-items';
import { TRACK_OPTIONS } from './carbon';

const draft = (p: Partial<CustomDraft> = {}): CustomDraft => ({ category: 'food', label: 'Paneer tikka', factor: 1.8, unit: 'item', qty: 1, ...p });

describe('custom items', () => {
  it('validates name, rate and amount', () => {
    expect(validateDraft(draft())).toEqual({});
    expect(validateDraft(draft({ label: '  ' })).label).toBeTruthy();
    expect(validateDraft(draft({ factor: -1 })).factor).toBeTruthy();
    expect(validateDraft(draft({ factor: 99999 })).factor).toMatch(/check the number/);
    expect(validateDraft(draft({ qty: 0 })).qty).toBeTruthy();
  });

  it('allows zero-emission items (a walk, a bike ride)', () => {
    expect(validateDraft(draft({ category: 'travel', factor: 0, unit: 'km', qty: 4 }))).toEqual({});
    expect(estimateKg({ factor: 0, qty: 4 })).toBe(0);
  });

  it('estimates kg from rate × amount', () => {
    expect(estimateKg({ factor: 1.8, qty: 2 })).toBe(3.6);
  });

  it('becomes a TrackOption the existing Track flow can log, and is recognisable as custom', () => {
    const o = toTrackOption(toCustomItem(draft({ basedOn: 'Chicken meal' }), 'ci-1'));
    expect(o).toMatchObject({ label: 'Paneer tikka', factor: 1.8, unit: 'item', defaultQty: 1, customId: 'ci-1', basedOn: 'Chicken meal' });
    expect(isCustom(o)).toBe(true);
    expect(isCustom(TRACK_OPTIONS.food[0])).toBe(false);
  });

  it('a re-saved name replaces the old item; the list is capped', () => {
    const a = toCustomItem(draft(), 'a');
    const b = toCustomItem(draft({ factor: 2 }), 'b');
    expect(upsert([a], b)).toEqual([b]);
    let list: ReturnType<typeof toCustomItem>[] = [];
    for (let i = 0; i < MAX_CUSTOM_ITEMS + 5; i++) list = upsert(list, toCustomItem(draft({ label: `Item ${i}` }), `id${i}`));
    expect(list).toHaveLength(MAX_CUSTOM_ITEMS);
    expect(list[0].label).toBe(`Item ${MAX_CUSTOM_ITEMS + 4}`);
  });

  it('ignores corrupt or tampered storage', () => {
    expect(parseStored('not json')).toEqual([]);
    expect(parseStored(JSON.stringify([{ id: 'x', label: 'ok', factor: 1, category: 'food', unit: 'item', defaultQty: 1 }, { id: 'y', label: 'bad', factor: -3, category: 'food', unit: 'item' }, { id: 'z', label: 'bad', factor: 1, category: 'pets', unit: 'item' }]))).toHaveLength(1);
  });
});
