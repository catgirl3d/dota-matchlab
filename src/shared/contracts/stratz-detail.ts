import * as v from 'valibot';
import { isShallowObject, type JsonObject } from './json';

const FiniteNumberSchema = v.pipe(v.number(), v.finite());

export const StratzDetailPayloadSchema = v.strictObject({
  section: v.string(),
  response: v.object({}),
});

// STRATZ adds fields regularly. Keep the provider boundary loose while naming
// only the fields used to verify identity and build canonical player rows.
export const StratzDetailPlayerSchema = v.object({
  matchId: v.optional(FiniteNumberSchema),
  steamAccountId: v.optional(FiniteNumberSchema),
  playerSlot: v.optional(v.unknown()),
  heroId: v.optional(v.unknown()),
  kills: v.optional(v.unknown()),
  deaths: v.optional(v.unknown()),
  assists: v.optional(v.unknown()),
  goldPerMinute: v.optional(v.unknown()),
  experiencePerMinute: v.optional(v.unknown()),
  numLastHits: v.optional(v.unknown()),
  numDenies: v.optional(v.unknown()),
  heroDamage: v.optional(v.unknown()),
  towerDamage: v.optional(v.unknown()),
  heroHealing: v.optional(v.unknown()),
  level: v.optional(v.unknown()),
  networth: v.optional(v.unknown()),
  leaverStatus: v.optional(v.unknown()),
});

export const StratzDetailMatchSchema = v.object({
  id: v.optional(v.unknown()),
  players: v.optional(v.array(v.unknown())),
  startDateTime: v.optional(v.unknown()),
  durationSeconds: v.optional(v.unknown()),
  didRadiantWin: v.optional(v.unknown()),
  gameMode: v.optional(v.unknown()),
  lobbyType: v.optional(v.unknown()),
  averageRank: v.optional(v.unknown()),
  clusterId: v.optional(v.unknown()),
  regionId: v.optional(v.unknown()),
  gameVersionId: v.optional(v.unknown()),
  radiantTeamId: v.optional(v.unknown()),
  direTeamId: v.optional(v.unknown()),
  leagueId: v.optional(v.unknown()),
  seriesId: v.optional(v.unknown()),
  seriesType: v.optional(v.unknown()),
  radiantScore: v.optional(v.unknown()),
  radiantKills: v.optional(v.unknown()),
  direScore: v.optional(v.unknown()),
  direKills: v.optional(v.unknown()),
});

export const StratzDetailEnvelopeSchema = v.object({
  data: v.optional(v.unknown()),
});

export type StratzDetailPayload = Omit<v.InferOutput<typeof StratzDetailPayloadSchema>, 'response'> & {
  response: JsonObject;
};
export type StratzDetailPlayer = v.InferOutput<typeof StratzDetailPlayerSchema>;
export type StratzDetailMatch = v.InferOutput<typeof StratzDetailMatchSchema>;

export function readStratzDetailMatch(value: unknown): StratzDetailMatch | null | undefined {
  const envelope = v.safeParse(StratzDetailEnvelopeSchema, value);
  if (!envelope.success || !isShallowObject(envelope.output.data)) return undefined;

  const match = envelope.output.data.match;
  if (match === null) return null;
  const parsedMatch = v.safeParse(StratzDetailMatchSchema, match);
  return parsedMatch.success ? parsedMatch.output : undefined;
}

export function readStratzDetailPlayers(value: unknown): StratzDetailPlayer[] {
  const match = readStratzDetailMatch(value);
  if (!match || !Array.isArray(match.players)) return [];

  return match.players.flatMap((player): StratzDetailPlayer[] => {
    const parsedPlayer = v.safeParse(StratzDetailPlayerSchema, player);
    return parsedPlayer.success ? [parsedPlayer.output] : [];
  });
}
