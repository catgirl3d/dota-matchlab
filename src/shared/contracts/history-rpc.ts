import * as v from 'valibot';
import { NonNegativeSafeIntegerSchema, PositiveSafeIntegerSchema } from './detail-ingestion';

const NonEmptyStringSchema = v.pipe(v.string(), v.minLength(1));
const HistoryProviderSchema = v.picklist(['stratz', 'opendota']);

export const HistorySyncClaimedSchema = v.strictObject({
  owned: v.literal(true),
  claimed: v.literal(true),
  status: v.literal('syncing'),
  dotaAccountId: PositiveSafeIntegerSchema,
  offset: NonNegativeSafeIntegerSchema,
  backfillComplete: v.boolean(),
  backfillUpperBoundMatchId: v.nullable(PositiveSafeIntegerSchema),
  leaseToken: NonEmptyStringSchema,
  historyProvider: HistoryProviderSchema,
});

export const HistorySyncClaimSyncingSchema = v.strictObject({
  owned: v.literal(true),
  claimed: v.literal(false),
  status: v.literal('syncing'),
  dotaAccountId: PositiveSafeIntegerSchema,
  historyProvider: HistoryProviderSchema,
});

export const HistorySyncClaimFailedSchema = v.strictObject({
  owned: v.literal(true),
  claimed: v.literal(false),
  status: v.literal('failed'),
  dotaAccountId: PositiveSafeIntegerSchema,
  retryAt: NonEmptyStringSchema,
  historyProvider: HistoryProviderSchema,
});

export const HistorySyncClaimNotOwnedSchema = v.strictObject({
  owned: v.literal(false),
  claimed: v.literal(false),
});

export const HistorySyncClaimSchema = v.union([
  HistorySyncClaimedSchema,
  HistorySyncClaimSyncingSchema,
  HistorySyncClaimFailedSchema,
  HistorySyncClaimNotOwnedSchema,
]);

export const HistorySyncApplyResponseSchema = v.strictObject({
  archivedMatches: NonNegativeSafeIntegerSchema,
  status: v.picklist(['partial', 'ready']),
  backfillComplete: v.boolean(),
  nextOffset: NonNegativeSafeIntegerSchema,
});

export const RecordMatchSyncFailureResponseSchema = v.strictObject({
  recorded: v.boolean(),
});

export type HistorySyncClaim = v.InferOutput<typeof HistorySyncClaimSchema>;
export type HistorySyncApplyResponse = v.InferOutput<typeof HistorySyncApplyResponseSchema>;
export type RecordMatchSyncFailureResponse = v.InferOutput<typeof RecordMatchSyncFailureResponseSchema>;
