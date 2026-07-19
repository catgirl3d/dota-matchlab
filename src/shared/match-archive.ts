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

export type MatchDetailSyncResult = {
  accountId: number;
  processedMatches: number;
  availableMatches: number;
  failedMatches: number;
  backfillComplete: boolean;
};

export type MatchImportResult = {
  matchId: number;
  status: 'available' | 'unavailable';
  imported: boolean;
};
