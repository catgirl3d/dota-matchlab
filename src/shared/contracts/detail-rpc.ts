import * as v from 'valibot';
import { NonNegativeSafeIntegerSchema, PositiveSafeIntegerSchema } from './detail-ingestion';

const NonEmptyStringSchema = v.pipe(v.string(), v.minLength(1));
const MatchIdsSchema = v.pipe(v.array(PositiveSafeIntegerSchema), v.minLength(1));

export const TrackedDetailClaimedSchema = v.strictObject({
  owned: v.literal(true),
  claimed: v.literal(true),
  status: v.literal('syncing'),
  dotaAccountId: PositiveSafeIntegerSchema,
  leaseToken: NonEmptyStringSchema,
  matchIds: MatchIdsSchema,
  backfillComplete: v.boolean(),
});

export const TrackedDetailUnclaimedSchema = v.strictObject({
  owned: v.literal(true),
  claimed: v.literal(false),
  status: v.picklist(['available', 'unavailable', 'syncing']),
  dotaAccountId: PositiveSafeIntegerSchema,
  matchIds: v.pipe(v.array(PositiveSafeIntegerSchema), v.length(0)),
  backfillComplete: v.boolean(),
});

export const TrackedDetailNotOwnedSchema = v.strictObject({
  owned: v.literal(false),
  claimed: v.literal(false),
});

export const TrackedDetailClaimSchema = v.union([
  TrackedDetailClaimedSchema,
  TrackedDetailUnclaimedSchema,
  TrackedDetailNotOwnedSchema,
]);

export const DetailApplyResponseSchema = v.strictObject({
  processedMatches: NonNegativeSafeIntegerSchema,
  backfillComplete: v.boolean(),
});

export const PublicDetailApplyResponseSchema = v.strictObject({
  match_id: PositiveSafeIntegerSchema,
  status: v.literal('available'),
});

export type TrackedDetailClaim = v.InferOutput<typeof TrackedDetailClaimSchema>;
export type DetailApplyResponse = v.InferOutput<typeof DetailApplyResponseSchema>;
export type PublicDetailApplyResponse = v.InferOutput<typeof PublicDetailApplyResponseSchema>;
