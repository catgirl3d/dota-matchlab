import { describe, expect, it } from 'vitest';
import {
  getAghanimItemKind,
  getPermanentAghanimUpgradeKind,
  getPermanentUpgradeItemIds,
} from './permanent-upgrades';

describe('Aghanim upgrades', () => {
  it('recognizes normal, permanent, and Roshan Aghanim item IDs', () => {
    expect(getAghanimItemKind(108)).toBe('scepter');
    expect(getAghanimItemKind(271)).toBe('scepter');
    expect(getAghanimItemKind(727)).toBe('scepter');
    expect(getAghanimItemKind(609)).toBe('shard');
    expect(getAghanimItemKind(725)).toBe('shard');
    expect(getAghanimItemKind(999_999)).toBeNull();
  });

  it('treats only blessing and Roshan variants as permanent upgrades', () => {
    expect(getPermanentAghanimUpgradeKind(108)).toBeNull();
    expect(getPermanentAghanimUpgradeKind(271)).toBe('scepter');
    expect(getPermanentAghanimUpgradeKind(727)).toBe('scepter');
    expect(getPermanentAghanimUpgradeKind(609)).toBe('shard');
    expect(getPermanentAghanimUpgradeKind(725)).toBe('shard');
  });

  it('keeps one permanent item ID for each upgrade type', () => {
    expect(getPermanentUpgradeItemIds([
      { itemId: 108 },
      { itemId: 609 },
      { itemId: 271 },
      { itemId: 725 },
      { itemId: 727 },
    ], [247])).toEqual({ scepterItemId: 271, shardItemId: 609, moonShardItemId: 247 });
  });

  it('does not infer a consumed Moon Shard from a purchase', () => {
    expect(getPermanentUpgradeItemIds([{ itemId: 247 }], [])).toEqual({
      scepterItemId: null,
      shardItemId: null,
      moonShardItemId: null,
    });
  });
});
