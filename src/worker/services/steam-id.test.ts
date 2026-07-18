import { describe, expect, it } from 'vitest';
import {
  InvalidSteamIdError,
  parseDotaAccountId,
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

  it('accepts only unsigned 32-bit account IDs', () => {
    expect(parseDotaAccountId('154783030')).toBe(154_783_030);
    expect(() => parseDotaAccountId('4294967296')).toThrow(InvalidSteamIdError);
  });
});
