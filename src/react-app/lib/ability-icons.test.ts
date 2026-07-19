import { describe, expect, it } from 'vitest';
import { getAbilityIcon } from './ability-icons';

describe('getAbilityIcon', () => {
  it('resolves an enriched STRATZ internal ability name to a bundled local asset', () => {
    expect(getAbilityIcon('sniper_shrapnel')?.src).toContain('sniper_shrapnel');
  });

  it('returns null for missing or unknown ability names', () => {
    expect(getAbilityIcon(null)).toBeNull();
    expect(getAbilityIcon('unknown_ability')).toBeNull();
  });
});
