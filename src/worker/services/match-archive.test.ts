import { describe, expect, it, vi } from 'vitest';
import type { ArchivedPlayerMatch, PlayerMatchesPage } from './opendota';
import { OpenDotaError } from './opendota';
import { syncTrackedAccount } from './match-archive';

const testEnv: Env = {
  CLERK_PUBLISHABLE_KEY: 'pk_test_example',
  CLERK_SECRET_KEY: 'sk_test_example',
  OPENDOTA_BASE_URL: 'https://api.opendota.com/api',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_example',
  SUPABASE_URL: 'https://example.supabase.co',
};

const trackedAccountId = '00000000-0000-0000-0000-000000000202';

describe('match archive sync', () => {
  it('claims, loads, and atomically applies one complete page', async () => {
    const archiveClient = createArchiveClient({
      claim: {
        owned: true,
        claimed: true,
        dotaAccountId: 123456789,
        offset: 0,
        backfillComplete: false,
        leaseToken: 'lease-token',
      },
      apply: {
        archivedMatches: 1,
        status: 'ready',
        backfillComplete: true,
        nextOffset: 0,
      },
    });
    const page: PlayerMatchesPage = {
      accountId: 123456789,
      offset: 0,
      limit: 100,
      nextOffset: 1,
      hasMore: false,
      matches: [
        {
          matchId: '9000000201',
          startTime: 1_700_001_000,
          durationSeconds: 1_800,
          radiantWin: false,
          gameMode: 22,
          lobbyType: 7,
          averageRank: null,
          cluster: null,
          version: null,
          radiantTeamId: null,
          direTeamId: null,
          leagueId: null,
          seriesId: null,
          seriesType: null,
          radiantScore: null,
          direScore: null,
          playerSlot: 0,
          heroId: 5,
          heroVariant: null,
          kills: 7,
          deaths: 2,
          assists: 11,
          goldPerMinute: 500,
          xpPerMinute: 600,
          lastHits: 180,
          denies: null,
          heroDamage: 24_000,
          towerDamage: 5_000,
          heroHealing: 0,
          level: null,
          netWorth: null,
          leaverStatus: null,
          partySize: 1,
          lane: null,
          laneRole: 1,
          isRoaming: null,
        },
      ],
    };
    const loadPlayerMatchesPage = vi.fn().mockResolvedValue(page);

    await expect(
      syncTrackedAccount(
        testEnv,
        'sync-user-a',
        trackedAccountId,
        {
          createClient: () => archiveClient,
          loadPlayerMatchesPage,
        },
      ),
    ).resolves.toEqual({
      trackedAccountId,
      accountId: 123456789,
      fetchedMatches: 1,
      archivedMatches: 1,
      status: 'ready',
      backfillComplete: true,
      nextOffset: 0,
    });

    expect(loadPlayerMatchesPage).toHaveBeenCalledWith(
      testEnv.OPENDOTA_BASE_URL,
      123456789,
      0,
      100,
    );
    expect(archiveClient.applyMatchSyncPageWithBoundary).toHaveBeenCalledWith(
      expect.objectContaining({
        p_actor_user_id: 'sync-user-a',
        p_tracked_account_id: trackedAccountId,
        p_dota_account_id: 123456789,
        p_lease_token: 'lease-token',
        p_next_offset: 0,
        p_backfill_complete: true,
        p_backfill_upper_bound_match_id: 9000000201,
        p_matches: [expect.objectContaining({ match_id: 9000000201 })],
      }),
    );
    expect(archiveClient.recordMatchSyncFailure).not.toHaveBeenCalled();
  });

  it('does not call OpenDota for an unowned tracked account', async () => {
    const archiveClient = createArchiveClient({
      claim: { owned: false, claimed: false },
    });
    const loadPlayerMatchesPage = vi.fn();

    await expect(
      syncTrackedAccount(
        testEnv,
        'sync-user-b',
        trackedAccountId,
        {
          createClient: () => archiveClient,
          loadPlayerMatchesPage,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(loadPlayerMatchesPage).not.toHaveBeenCalled();
    expect(archiveClient.applyMatchSyncPageWithBoundary).not.toHaveBeenCalled();
  });

  it('returns conflict when another sync owns the lease', async () => {
    const archiveClient = createArchiveClient({
      claim: {
        owned: true,
        claimed: false,
        status: 'syncing',
      },
    });
    const loadPlayerMatchesPage = vi.fn();

    await expect(
      syncTrackedAccount(
        testEnv,
        'sync-user-a',
        trackedAccountId,
        {
          createClient: () => archiveClient,
          loadPlayerMatchesPage,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(loadPlayerMatchesPage).not.toHaveBeenCalled();
  });

  it('filters newly inserted matches above the backfill high-water mark', async () => {
    const archiveClient = createArchiveClient({
      claim: {
        owned: true,
        claimed: true,
        dotaAccountId: 123456789,
        offset: 100,
        backfillComplete: false,
        backfillUpperBoundMatchId: 9000000200,
        leaseToken: 'lease-token',
      },
      apply: {
        archivedMatches: 1,
        status: 'partial',
        backfillComplete: false,
        nextOffset: 200,
      },
    });
    const loadPlayerMatchesPage = vi.fn().mockResolvedValue({
      accountId: 123456789,
      offset: 100,
      limit: 100,
      nextOffset: 200,
      hasMore: true,
      matches: [createArchivedMatch('9000000300'), createArchivedMatch('9000000199')],
    } satisfies PlayerMatchesPage);

    await syncTrackedAccount(
      testEnv,
      'sync-user-a',
      trackedAccountId,
      {
        createClient: () => archiveClient,
        loadPlayerMatchesPage,
      },
    );

    expect(archiveClient.applyMatchSyncPageWithBoundary).toHaveBeenCalledWith(
      expect.objectContaining({
        p_backfill_upper_bound_match_id: 9000000200,
        p_next_offset: 200,
        p_backfill_complete: false,
        p_matches: [expect.objectContaining({ match_id: 9000000199 })],
      }),
    );
  });

  it('continues a new incremental scan when the first page is full', async () => {
    const archiveClient = createArchiveClient({
      claim: {
        owned: true,
        claimed: true,
        dotaAccountId: 123456789,
        offset: 0,
        backfillComplete: true,
        backfillUpperBoundMatchId: null,
        leaseToken: 'lease-token',
      },
      apply: {
        archivedMatches: 2,
        status: 'partial',
        backfillComplete: false,
        nextOffset: 100,
      },
    });
    const loadPlayerMatchesPage = vi.fn().mockResolvedValue({
      accountId: 123456789,
      offset: 0,
      limit: 100,
      nextOffset: 100,
      hasMore: true,
      matches: [createArchivedMatch('9000000300'), createArchivedMatch('9000000299')],
    } satisfies PlayerMatchesPage);

    await syncTrackedAccount(
      testEnv,
      'sync-user-a',
      trackedAccountId,
      {
        createClient: () => archiveClient,
        loadPlayerMatchesPage,
      },
    );

    expect(archiveClient.applyMatchSyncPageWithBoundary).toHaveBeenCalledWith(
      expect.objectContaining({
        p_backfill_upper_bound_match_id: 9000000300,
        p_next_offset: 100,
        p_backfill_complete: false,
      }),
    );
  });

  it('records an OpenDota failure against the active lease', async () => {
    const archiveClient = createArchiveClient({
      claim: {
        owned: true,
        claimed: true,
        dotaAccountId: 123456789,
        offset: 100,
        backfillComplete: false,
        leaseToken: 'lease-token',
      },
    });
    const providerError = new OpenDotaError('Лимит OpenDota исчерпан', 429);
    const loadPlayerMatchesPage = vi.fn().mockRejectedValue(providerError);

    await expect(
      syncTrackedAccount(
        testEnv,
        'sync-user-a',
        trackedAccountId,
        {
          createClient: () => archiveClient,
          loadPlayerMatchesPage,
        },
      ),
    ).rejects.toBe(providerError);

    expect(archiveClient.recordMatchSyncFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        p_dota_account_id: 123456789,
        p_lease_token: 'lease-token',
        p_error_code: 'OPEN_DOTA_429',
        p_error_message: 'Лимит OpenDota исчерпан',
      }),
    );
  });
});

function createArchiveClient(options: {
  claim: Record<string, unknown>;
  apply?: Record<string, unknown>;
}) {
  return {
    claimMatchSync: vi.fn().mockResolvedValue({
      data: options.claim,
      error: null,
    }),
    applyMatchSyncPageWithBoundary: vi.fn().mockResolvedValue({
      data: options.apply ?? {},
      error: null,
    }),
    recordMatchSyncFailure: vi.fn().mockResolvedValue({
      data: { recorded: true },
      error: null,
    }),
  };
}

function createArchivedMatch(matchId: string): ArchivedPlayerMatch {
  return {
    matchId,
    startTime: null,
    durationSeconds: null,
    radiantWin: true,
    gameMode: null,
    lobbyType: null,
    averageRank: null,
    cluster: null,
    version: null,
    radiantTeamId: null,
    direTeamId: null,
    leagueId: null,
    seriesId: null,
    seriesType: null,
    radiantScore: null,
    direScore: null,
    playerSlot: 0,
    heroId: 1,
    heroVariant: null,
    kills: null,
    deaths: null,
    assists: null,
    goldPerMinute: null,
    xpPerMinute: null,
    lastHits: null,
    denies: null,
    heroDamage: null,
    towerDamage: null,
    heroHealing: null,
    level: null,
    netWorth: null,
    leaverStatus: null,
    partySize: null,
    lane: null,
    laneRole: null,
    isRoaming: null,
  };
}
