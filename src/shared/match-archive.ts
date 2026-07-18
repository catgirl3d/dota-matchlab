export type MatchSyncStatus = 'partial' | 'ready';

export type MatchSyncResult = {
  trackedAccountId: string;
  accountId: number;
  fetchedMatches: number;
  archivedMatches: number;
  status: MatchSyncStatus;
  backfillComplete: boolean;
  nextOffset: number;
};
