import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import {
  NormalizedDetailPlayerSchema,
  type NormalizedDetailPlayer,
} from './detail-ingestion';
import {
  DetailApplyResponseSchema,
  PublicDetailApplyResponseSchema,
  TrackedDetailClaimSchema,
} from './detail-rpc';
import {
  StratzDetailPayloadSchema,
  readStratzDetailMatch,
  readStratzDetailPlayers,
} from './stratz-detail';
import { JsonObjectSchema, readNullableSafeInteger, readSafeInteger } from './json';

describe('detail boundary contracts', () => {
  it('accepts JSON primitives and rejects non-JSON numbers', () => {
    expect(v.safeParse(JsonObjectSchema, {
      text: 'value',
      number: 1,
      flag: true,
      nested: [null, { value: false }],
    }).success).toBe(true);
    expect(v.safeParse(JsonObjectSchema, { number: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(readSafeInteger(7)).toBe(7);
    expect(readSafeInteger(7.5)).toBeNull();
    expect(readNullableSafeInteger(null)).toBeNull();
    expect(readNullableSafeInteger(undefined)).toBeNull();
  });

  it('accepts each legitimate tracked detail claim variant', () => {
    expect(v.safeParse(TrackedDetailClaimSchema, {
      owned: true,
      claimed: true,
      status: 'syncing',
      dotaAccountId: 77,
      leaseToken: 'lease-token',
      matchIds: [9001],
      backfillComplete: false,
    }).success).toBe(true);
    expect(v.safeParse(TrackedDetailClaimSchema, {
      owned: true,
      claimed: false,
      status: 'unavailable',
      dotaAccountId: 77,
      matchIds: [],
      backfillComplete: true,
    }).success).toBe(true);
    expect(v.safeParse(TrackedDetailClaimSchema, {
      owned: true,
      claimed: false,
      status: 'syncing',
      dotaAccountId: 77,
      matchIds: [],
      backfillComplete: false,
    }).success).toBe(true);
    expect(v.safeParse(TrackedDetailClaimSchema, {
      owned: true,
      claimed: false,
      status: 'available',
      dotaAccountId: 77,
      matchIds: [],
      backfillComplete: true,
    }).success).toBe(true);
    expect(v.safeParse(TrackedDetailClaimSchema, {
      owned: false,
      claimed: false,
    }).success).toBe(true);
  });

  it('rejects malformed claim and RPC response contracts', () => {
    expect(v.safeParse(TrackedDetailClaimSchema, {
      owned: true,
      claimed: true,
      status: 'syncing',
      dotaAccountId: 77,
      matchIds: [9001],
      backfillComplete: false,
    }).success).toBe(false);
    expect(v.safeParse(TrackedDetailClaimSchema, {
      owned: true,
      claimed: false,
      status: 'available',
      dotaAccountId: 77,
      matchIds: [9001],
      backfillComplete: false,
    }).success).toBe(false);
    expect(v.safeParse(TrackedDetailClaimSchema, {
      owned: true,
      claimed: false,
      status: 'failed',
      dotaAccountId: 77,
      matchIds: [],
      backfillComplete: false,
    }).success).toBe(false);
    expect(v.safeParse(DetailApplyResponseSchema, {
      processedMatches: -1,
      backfillComplete: false,
    }).success).toBe(false);
    expect(v.safeParse(PublicDetailApplyResponseSchema, {
      matchId: 9001,
      status: 'available',
    }).success).toBe(false);
  });

  it('keeps raw STRATZ provider payloads opaque while reading known fields', () => {
    const response = {
      data: {
        match: {
          id: 9001,
          providerOnly: { nested: ['preserve', true] },
          players: [{ matchId: 9001, steamAccountId: 77, customField: 'keep' }],
        },
      },
    };
    const payload = v.safeParse(StratzDetailPayloadSchema, { section: 'players', response });

    expect(payload.success).toBe(true);
    expect(readStratzDetailMatch(response)).toMatchObject({ id: 9001 });
    expect(readStratzDetailPlayers(response)).toEqual([
      { matchId: 9001, steamAccountId: 77 },
    ]);
    expect(response.data.match.providerOnly).toEqual({ nested: ['preserve', true] });
  });

  it('skips malformed provider rows without rejecting the player section', () => {
    const response = {
      data: {
        match: {
          players: [
            { matchId: 9001, steamAccountId: 77 },
            { matchId: '9001', steamAccountId: 78 },
            { matchId: 9001, steamAccountId: '79' },
          ],
        },
      },
    };

    expect(readStratzDetailPlayers(response)).toEqual([
      expect.objectContaining({ matchId: 9001, steamAccountId: 77 }),
    ]);
  });

  it('enforces canonical integer and table-range boundaries', () => {
    const player: NormalizedDetailPlayer = v.parse(NormalizedDetailPlayerSchema, canonicalPlayer());
    expect(player).toMatchObject({ match_id: 9001, account_id: 4_294_967_295, player_slot: 255 });
    expect(v.safeParse(NormalizedDetailPlayerSchema, {
      ...canonicalPlayer(),
      account_id: 4_294_967_296,
    }).success).toBe(false);
    expect(v.safeParse(NormalizedDetailPlayerSchema, {
      ...canonicalPlayer(),
      player_slot: 256,
    }).success).toBe(false);
    expect(v.safeParse(NormalizedDetailPlayerSchema, {
      ...canonicalPlayer(),
      hero_id: 0,
    }).success).toBe(false);
  });
});

function canonicalPlayer(): NormalizedDetailPlayer {
  return {
    match_id: 9001,
    account_id: 4_294_967_295,
    player_slot: 255,
    hero_id: 1,
    kills: 1,
    deaths: null,
    assists: null,
    gold_per_min: null,
    xp_per_min: null,
    last_hits: null,
    denies: null,
    hero_damage: null,
    tower_damage: null,
    hero_healing: null,
    level: null,
    net_worth: null,
    leaver_status: null,
  };
}
