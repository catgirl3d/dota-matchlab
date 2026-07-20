import * as v from 'valibot';

const SafeIntegerSchema = v.pipe(v.number(), v.finite(), v.integer(), v.minValue(-9_007_199_254_740_991), v.maxValue(9_007_199_254_740_991));
const NullableDatabaseIntegerSchema = v.nullable(v.pipe(SafeIntegerSchema, v.minValue(-2_147_483_648), v.maxValue(2_147_483_647)));
const NullableSmallIntegerSchema = v.nullable(v.pipe(SafeIntegerSchema, v.minValue(-32_768), v.maxValue(32_767)));

export const PositiveSafeIntegerSchema = v.pipe(SafeIntegerSchema, v.minValue(1));
export const NonNegativeSafeIntegerSchema = v.pipe(SafeIntegerSchema, v.minValue(0));
export const AccountIdSchema = v.pipe(SafeIntegerSchema, v.minValue(0), v.maxValue(4_294_967_295));

export const NormalizedDetailPlayerSchema = v.strictObject({
  match_id: PositiveSafeIntegerSchema,
  account_id: AccountIdSchema,
  player_slot: v.nullable(v.pipe(SafeIntegerSchema, v.minValue(0), v.maxValue(255))),
  hero_id: v.nullable(v.pipe(SafeIntegerSchema, v.minValue(1), v.maxValue(32_767))),
  kills: NullableDatabaseIntegerSchema,
  deaths: NullableDatabaseIntegerSchema,
  assists: NullableDatabaseIntegerSchema,
  gold_per_min: NullableDatabaseIntegerSchema,
  xp_per_min: NullableDatabaseIntegerSchema,
  last_hits: NullableDatabaseIntegerSchema,
  denies: NullableDatabaseIntegerSchema,
  hero_damage: NullableDatabaseIntegerSchema,
  tower_damage: NullableDatabaseIntegerSchema,
  hero_healing: NullableDatabaseIntegerSchema,
  level: NullableSmallIntegerSchema,
  net_worth: NullableDatabaseIntegerSchema,
  leaver_status: NullableSmallIntegerSchema,
});

export const NormalizedDetailPlayersSchema = v.pipe(
  v.array(NormalizedDetailPlayerSchema),
  v.minLength(1),
);

export type NormalizedDetailPlayer = v.InferOutput<typeof NormalizedDetailPlayerSchema>;
export type NormalizedDetailPlayers = v.InferOutput<typeof NormalizedDetailPlayersSchema>;
