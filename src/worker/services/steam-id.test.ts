import { describe, expect, it } from 'vitest';
import {
  InvalidSteamIdError,
  steamId64ToAccountId,
} from './steam-id';

describe('Steam and Dota identifiers', () => {
  it('converts SteamID64 without losing integer precision', () => {
    expect(steamId64ToAccountId('76561198115048758')).toBe(154_783_030);
  });

  it('rejects IDs outside the Dota account range', () => {
    expect(() => steamId64ToAccountId('76561197960265727')).toThrow(
      InvalidSteamIdError,
    );
  });
});
