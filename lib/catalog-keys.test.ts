import { describe, expect, it } from 'vitest';
import { CATEGORIES, TRACK_OPTIONS } from './carbon';
import { factorKeyFor } from './catalog-keys';

describe('factorKeyFor', () => {
  it('maps every Track option to a backend emission-factor key', () => {
    for (const c of CATEGORIES) for (const o of TRACK_OPTIONS[c.id]) expect(factorKeyFor(c.id, o.label), `${c.id}/${o.label}`).toBeTruthy();
  });
});
