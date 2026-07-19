import { describe, expect, it } from 'vitest';
import { getItemIcon } from './item-icons';

describe('getItemIcon', () => {
  it('resolves item IDs to bundled local asset URLs', () => {
    expect(getItemIcon(50)).toMatchObject({ label: 'Phase Boots' });
    expect(getItemIcon(50)?.src).toContain('phase_boots');
    expect(getItemIcon(287)?.src).toContain('keen_optic');
    expect(getItemIcon(1717)).toMatchObject({ label: 'Ash Legion Shield' });
    expect(getItemIcon(1717)?.src).toContain('ash_legion_shield');
    expect(getItemIcon(140)).toMatchObject({ label: 'Greater Crit Recipe' });
    expect(getItemIcon(140)?.src).toContain('recipe');
  });

  it('returns null when an item does not have a local icon', () => {
    expect(getItemIcon(999_999)).toBeNull();
  });
});
