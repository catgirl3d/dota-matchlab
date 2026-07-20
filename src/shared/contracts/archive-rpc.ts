import * as v from 'valibot';

const NumberSchema = v.pipe(v.number(), v.finite());
const NullableNumberSchema = v.nullable(NumberSchema);
const NullableStringSchema = v.nullable(v.string());
const NullableBooleanSchema = v.nullable(v.boolean());

export const ArchiveSyncStateSchema = v.object({
  status: v.string(),
  history_provider: v.string(),
  backfill_offset: NumberSchema,
  backfill_complete: v.boolean(),
  last_attempt_at: NullableStringSchema,
  last_success_at: NullableStringSchema,
  next_retry_at: NullableStringSchema,
  consecutive_failures: NumberSchema,
  last_error_message: NullableStringSchema,
  newest_match_id: NullableNumberSchema,
  oldest_match_id: NullableNumberSchema,
});

const ArchiveSummarySchema = v.object({
  matches: NumberSchema,
  wins: NumberSchema,
  losses: NumberSchema,
  unknown_results: NumberSchema,
  win_rate: NumberSchema,
  average_kills: NumberSchema,
  average_deaths: NumberSchema,
  average_assists: NumberSchema,
  average_kda: NumberSchema,
  average_gpm: NumberSchema,
  average_xpm: NumberSchema,
  average_last_hits: NumberSchema,
  average_damage: NumberSchema,
  average_duration_minutes: NumberSchema,
  first_match_at: NullableNumberSchema,
  latest_match_at: NullableNumberSchema,
});

export const ArchiveBreakdownProjectionSchema = v.object({
  key: v.string(),
  label: v.string(),
  matches: NumberSchema,
  wins: NumberSchema,
  winRate: NumberSchema,
});

export const ArchiveHeroBreakdownProjectionSchema = v.object({
  key: v.string(),
  heroId: NumberSchema,
  matches: NumberSchema,
  wins: NumberSchema,
  winRate: NumberSchema,
  averageKda: NumberSchema,
  averageGpm: NumberSchema,
});

export const ArchiveOverviewRpcSchema = v.object({
  summary: ArchiveSummarySchema,
  form: v.array(v.picklist(['win', 'loss', 'unknown'])),
  modes: v.array(ArchiveBreakdownProjectionSchema),
  heroes: v.array(ArchiveHeroBreakdownProjectionSchema),
  positions: v.array(ArchiveBreakdownProjectionSchema),
  lanes: v.array(ArchiveBreakdownProjectionSchema),
  party: v.array(ArchiveBreakdownProjectionSchema),
  tempo: v.array(ArchiveBreakdownProjectionSchema),
  heroOptions: v.array(NumberSchema),
  syncState: v.nullable(ArchiveSyncStateSchema),
  integrity: v.object({
    linked: NumberSchema,
    complete: NumberSchema,
    missing_stats: NumberSchema,
    missing_match: NumberSchema,
  }),
});

export const ArchiveMatchProjectionSchema = v.object({
  dataStatus: v.picklist(['complete', 'missing_player_stats']),
  matchId: NumberSchema,
  startTime: NullableNumberSchema,
  durationSeconds: NullableNumberSchema,
  radiantWin: NullableBooleanSchema,
  gameMode: NullableNumberSchema,
  lobbyType: NullableNumberSchema,
  averageRank: NullableNumberSchema,
  radiantScore: NullableNumberSchema,
  direScore: NullableNumberSchema,
  playerSlot: NullableNumberSchema,
  heroId: NullableNumberSchema,
  heroVariant: NullableNumberSchema,
  kills: NullableNumberSchema,
  deaths: NullableNumberSchema,
  assists: NullableNumberSchema,
  goldPerMinute: NullableNumberSchema,
  xpPerMinute: NullableNumberSchema,
  lastHits: NullableNumberSchema,
  denies: NullableNumberSchema,
  heroDamage: NullableNumberSchema,
  towerDamage: NullableNumberSchema,
  heroHealing: NullableNumberSchema,
  level: NullableNumberSchema,
  netWorth: NullableNumberSchema,
  leaverStatus: NullableNumberSchema,
  partySize: NullableNumberSchema,
  lane: NullableNumberSchema,
  laneRole: NullableNumberSchema,
  isRoaming: NullableBooleanSchema,
  won: NullableBooleanSchema,
});

export const ArchiveCursorProjectionSchema = v.object({
  startTime: NullableNumberSchema,
  matchId: NumberSchema,
});

export const ArchivePageRpcSchema = v.object({
  matches: v.array(ArchiveMatchProjectionSchema),
  nextCursor: v.nullable(ArchiveCursorProjectionSchema),
});

export const ArchiveShowcaseOverviewRpcSchema = v.object({
  account: v.object({
    dotaAccountId: NumberSchema,
    personaName: NullableStringSchema,
    avatarUrl: NullableStringSchema,
    rankTier: NullableNumberSchema,
    profileRefreshedAt: NullableStringSchema,
  }),
  overview: ArchiveOverviewRpcSchema,
});

export const ArchiveShowcaseSlugRpcSchema = NumberSchema;

export type ArchiveSyncStateProjection = v.InferOutput<typeof ArchiveSyncStateSchema>;
export type ArchiveOverviewProjection = v.InferOutput<typeof ArchiveOverviewRpcSchema>;
export type ArchiveMatchProjection = v.InferOutput<typeof ArchiveMatchProjectionSchema>;
export type ArchiveCursorProjection = v.InferOutput<typeof ArchiveCursorProjectionSchema>;
export type ArchivePageProjection = v.InferOutput<typeof ArchivePageRpcSchema>;
export type ArchiveShowcaseOverviewProjection = v.InferOutput<typeof ArchiveShowcaseOverviewRpcSchema>;

export function parseArchiveOverview(value: unknown): ArchiveOverviewProjection {
  return parseArchiveProjection(ArchiveOverviewRpcSchema, value, 'overview');
}

export function parseArchivePage(value: unknown): ArchivePageProjection {
  return parseArchiveProjection(ArchivePageRpcSchema, value, 'page');
}

export function parseArchiveShowcaseOverview(value: unknown): ArchiveShowcaseOverviewProjection {
  return parseArchiveProjection(ArchiveShowcaseOverviewRpcSchema, value, 'showcase overview');
}

export function parseArchiveShowcaseSlug(value: unknown): number {
  return parseArchiveProjection(ArchiveShowcaseSlugRpcSchema, value, 'showcase slug');
}

function parseArchiveProjection<TOutput>(
  schema: v.GenericSchema<unknown, TOutput>,
  value: unknown,
  label: string,
): TOutput {
  const parsed = v.safeParse(schema, value);
  if (!parsed.success) throw new Error(`Invalid response ${label}`);
  return parsed.output;
}
