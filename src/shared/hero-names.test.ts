import { describe, expect, it } from 'vitest';
import { DOTA_HERO_NAMES } from './hero-names';

describe('DOTA_HERO_NAMES', () => {
  it('contains the current complete hero roster', () => {
    expect(Object.keys(DOTA_HERO_NAMES)).toHaveLength(127);
    expect(DOTA_HERO_NAMES).toMatchObject({
      1: 'Anti-Mage',
      35: 'Sniper',
      53: "Nature's Prophet",
      129: 'Mars',
      155: 'Largo',
    });
  });
});
