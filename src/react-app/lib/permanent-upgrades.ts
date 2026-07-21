export type AghanimItemKind = 'scepter' | 'shard';

export type PermanentUpgradeItemIds = {
  scepterItemId: number | null;
  shardItemId: number | null;
  moonShardItemId: number | null;
};

const aghanimItemKinds = new Map<number, AghanimItemKind>([
  [108, 'scepter'],
  [271, 'scepter'],
  [727, 'scepter'],
  [609, 'shard'],
  [725, 'shard'],
]);

const permanentAghanimUpgradeKinds = new Map<number, AghanimItemKind>([
  [271, 'scepter'],
  [727, 'scepter'],
  [609, 'shard'],
  [725, 'shard'],
]);

const MOON_SHARD_ITEM_ID = 247;

export function getAghanimItemKind(itemId: number): AghanimItemKind | null {
  return aghanimItemKinds.get(itemId) ?? null;
}

export function getPermanentAghanimUpgradeKind(itemId: number): AghanimItemKind | null {
  return permanentAghanimUpgradeKinds.get(itemId) ?? null;
}

export function getPermanentUpgradeItemIds(
  purchases: Iterable<{ itemId: number }>,
  buffItemIds: Iterable<number>,
): PermanentUpgradeItemIds {
  let scepterItemId: number | null = null;
  let shardItemId: number | null = null;

  for (const purchase of purchases) {
    const kind = getPermanentAghanimUpgradeKind(purchase.itemId);
    if (kind === 'scepter' && scepterItemId === null) {
      scepterItemId = purchase.itemId;
    }
    if (kind === 'shard' && shardItemId === null) {
      shardItemId = purchase.itemId;
    }
  }

  const moonShardItemId = [...buffItemIds].includes(MOON_SHARD_ITEM_ID)
    ? MOON_SHARD_ITEM_ID
    : null;

  return { scepterItemId, shardItemId, moonShardItemId };
}
