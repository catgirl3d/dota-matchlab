export type DotaPlayerProfile = {
  steamId64: string;
  accountId: number;
  personaName: string;
  avatarUrl: string | null;
  rankTier: number | null;
};

export type RecentDotaMatch = {
  matchId: string;
  startTime: number;
  durationSeconds: number;
  heroId: number;
  heroName: string;
  won: boolean;
  kills: number;
  deaths: number;
  assists: number;
  goldPerMinute: number;
  xpPerMinute: number;
  lastHits: number;
};

export type RecentMatchesResponse = {
  accountId: number;
  matches: RecentDotaMatch[];
};

export type HeroNamesResponse = {
  heroes: Record<string, string>;
};
