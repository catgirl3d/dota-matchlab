import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import {
  HistorySyncApplyResponseSchema,
  HistorySyncClaimSchema,
  RecordMatchSyncFailureResponseSchema,
} from './history-rpc';

describe('history RPC contracts', () => {
  it('accepts exact SQL claim variants', () => {
    expect(v.safeParse(HistorySyncClaimSchema, {
      owned: true,
      claimed: true,
      status: 'syncing',
      dotaAccountId: 77,
      offset: 0,
      backfillComplete: false,
      backfillUpperBoundMatchId: null,
      leaseToken: 'lease-token',
      historyProvider: 'stratz',
    }).success).toBe(true);
    expect(v.safeParse(HistorySyncClaimSchema, {
      owned: true,
      claimed: false,
      status: 'syncing',
      dotaAccountId: 77,
      historyProvider: 'opendota',
    }).success).toBe(true);
    expect(v.safeParse(HistorySyncClaimSchema, {
      owned: true,
      claimed: false,
      status: 'failed',
      dotaAccountId: 77,
      retryAt: '2026-07-21T00:00:00.000Z',
      historyProvider: 'stratz',
    }).success).toBe(true);
    expect(v.safeParse(HistorySyncClaimSchema, {
      owned: false,
      claimed: false,
    }).success).toBe(true);
  });

  it('rejects malformed history claim and apply responses', () => {
    expect(v.safeParse(HistorySyncClaimSchema, {
      owned: true,
      claimed: true,
      status: 'syncing',
      dotaAccountId: 77,
      offset: 0,
      backfillComplete: false,
      backfillUpperBoundMatchId: null,
      historyProvider: 'stratz',
    }).success).toBe(false);
    expect(v.safeParse(HistorySyncApplyResponseSchema, {
      archivedMatches: 1,
      status: 'unexpected',
      backfillComplete: false,
      nextOffset: 0,
    }).success).toBe(false);
    expect(v.safeParse(RecordMatchSyncFailureResponseSchema, { recorded: 'yes' }).success).toBe(false);
  });
});
