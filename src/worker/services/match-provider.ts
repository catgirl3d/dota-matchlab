import type { Json } from '../../shared/database.types';

export type MatchHistoryProvider = 'stratz' | 'opendota';
export type ProviderPayloadKind = 'history' | 'detail';

export type ArchivedPlayerMatch = {
  matchId: string;
  startTime: number | null;
  durationSeconds: number | null;
  radiantWin: boolean;
  gameMode: number | null;
  lobbyType: number | null;
  averageRank: number | null;
  cluster: number | null;
  version: number | null;
  radiantTeamId: number | null;
  direTeamId: number | null;
  leagueId: number | null;
  seriesId: number | null;
  seriesType: number | null;
  radiantScore: number | null;
  direScore: number | null;
  playerSlot: number;
  heroId: number;
  heroVariant: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  goldPerMinute: number | null;
  xpPerMinute: number | null;
  lastHits: number | null;
  denies: number | null;
  heroDamage: number | null;
  towerDamage: number | null;
  heroHealing: number | null;
  level: number | null;
  netWorth: number | null;
  leaverStatus: number | null;
  partySize: number | null;
  lane: number | null;
  laneRole: number | null;
  isRoaming: boolean | null;
  rawPayload: Json;
  rawPayloadKind: ProviderPayloadKind;
  rawPayloadSchemaVersion: string;
};

export type PlayerMatchesPage = {
  accountId: number;
  offset: number;
  limit: number;
  matches: ArchivedPlayerMatch[];
  nextOffset: number;
  hasMore: boolean;
};
