import { describe, expect, it } from 'vitest';
import { railTravel } from './rail';

describe('railTravel', () => {
  it('is zero when everything fits, padding included', () => {
    expect(railTravel(1114, 1300, 24, 24)).toBe(0);
    expect(railTravel(1114, 1162, 24, 24)).toBe(0); // exactly fits
  });

  it('counts the padding so the last item can clear the right edge', () => {
    // 1114 of cards in a 1100 container with 24px padding each side: 62px of travel, not 14.
    expect(railTravel(1114, 1100, 24, 24)).toBe(62);
  });

  it('gives the full overflow on a narrow screen', () => {
    expect(railTravel(1114, 529, 20, 20)).toBe(625);
  });

  it('ignores sub-pixel rounding noise', () => {
    expect(railTravel(1000.2, 1048, 24, 24)).toBe(0);
  });
});
