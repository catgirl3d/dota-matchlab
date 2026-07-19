import { describe, expect, it } from 'vitest';
import { heroIconSlugs } from './hero-icon-slugs';
import { getHeroIcon, getHeroPortrait } from './hero-icons';

describe('getHeroIcon', () => {
  it('resolves a known hero to a bundled local asset and label', () => {
    expect(getHeroIcon(1, 'Anti-Mage')).toMatchObject({ label: 'Anti-Mage' });
    expect(getHeroIcon(1, 'Anti-Mage')?.src).toContain('antimage_icon_5fO3');
  });

  it('resolves every mapped hero to its local square and horizontal assets', () => {
    for (const [heroId, slug] of Object.entries(heroIconSlugs)) {
      expect(getHeroIcon(Number(heroId))?.src).toContain(`${slug}_icon_5fO3.webp`);
      expect(getHeroPortrait(Number(heroId))?.src).toContain(`${slug}_horz_gMtz.webp`);
    }
  });

  it('returns null when a hero ID has no local icon mapping', () => {
    expect(getHeroIcon(999_999, 'Unknown hero')).toBeNull();
  });
});
