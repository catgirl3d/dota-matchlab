import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ARCHIVE_FILTERS } from './archive-analytics';
import { fetchArchiveOverview, fetchArchivePage, fetchArchiveShowcaseOverview, fetchArchiveShowcasePage, resolveArchiveShowcase } from './archive';

describe('archive RPC adapter', () => {
  it('maps overview JSON and forwards the abort signal', async () => {
    const abortSignal = new AbortController().signal;
    const client = createFakeClient({
      summary: { matches: 1, wins: 1, losses: 0, unknown_results: 0, win_rate: 100, average_kills: 10, average_deaths: 2, average_assists: 8, average_kda: 9, average_gpm: 600, average_xpm: 700, average_last_hits: 300, average_damage: 30000, average_duration_minutes: 40, first_match_at: 1, latest_match_at: 1 },
      form: ['win'], modes: [], heroes: [{ key: '1', heroId: 1, matches: 1, wins: 1, winRate: 100, averageKda: 9, averageGpm: 600 }], positions: [], lanes: [], party: [], tempo: [], heroOptions: [1],
      syncState: {
        status: 'ready', history_provider: 'stratz', backfill_offset: 500, backfill_complete: true,
        last_attempt_at: '2026-07-20T10:00:00.000Z', last_success_at: '2026-07-20T10:00:00.000Z', next_retry_at: null,
        consecutive_failures: 0, last_error_message: null, newest_match_id: 9, oldest_match_id: 9,
      },
      integrity: { linked: 2, complete: 1, missing_stats: 1, missing_match: 0 },
    });

    await expect(fetchArchiveOverview(client, 'account', DEFAULT_ARCHIVE_FILTERS, abortSignal)).resolves.toMatchObject({
      summary: { matches: 1, unknownResults: 0 }, integrity: { missingStats: 1 }, heroOptions: [1],
      syncState: { status: 'ready', backfill_complete: true, newest_match_id: 9 },
      heroes: [{ heroId: 1, averageKda: 9 }],
    });
    expect(client.rpc).toHaveBeenCalledWith('get_match_archive_overview', expect.objectContaining({ p_tracked_account_id: 'account' }));
    expect(client.abortSignal).toHaveBeenCalledWith(abortSignal);
  });

  it('maps deterministic page cursors and RPC filter arguments', async () => {
    const client = createFakeClient({ matches: [{ dataStatus: 'missing_player_stats', matchId: 9, startTime: null, durationSeconds: null, radiantWin: null, gameMode: null, lobbyType: null, averageRank: null, radiantScore: null, direScore: null, playerSlot: null, heroId: null, heroVariant: null, kills: null, deaths: null, assists: null, goldPerMinute: null, xpPerMinute: null, lastHits: null, denies: null, heroDamage: null, towerDamage: null, heroHealing: null, level: null, netWorth: null, leaverStatus: null, partySize: null, lane: null, laneRole: null, isRoaming: null, won: null }], nextCursor: { startTime: null, matchId: 9 } });
    const customRange = { ...DEFAULT_ARCHIVE_FILTERS, period: 'custom' as const, startDate: '2026-01-10', endDate: '2026-02-20', result: 'wins' as const };
    await expect(fetchArchivePage(client, 'account', customRange, { startTime: 100, matchId: 10 })).resolves.toMatchObject({ nextCursor: { matchId: 9 }, matches: [{ matchId: 9, dataStatus: 'missing_player_stats' }] });
    expect(client.rpc).toHaveBeenCalledWith('get_match_archive_page', expect.objectContaining({ p_period: 'custom', p_start_date: '2026-01-10', p_end_date: '2026-02-20', p_result: 'wins', p_cursor_start_time: 100, p_cursor_match_id: 10, p_limit: 100 }));
  });

  it('maps a nullable public showcase without tracked-account identifiers', async () => {
    const client = createFakeClient({
      account: { dotaAccountId: 77, personaName: 'Curated', avatarUrl: null, rankTier: 54, profileRefreshedAt: null },
      overview: { summary: { matches: 0, wins: 0, losses: 0, unknown_results: 0, win_rate: 0, average_kills: 0, average_deaths: 0, average_assists: 0, average_kda: 0, average_gpm: 0, average_xpm: 0, average_last_hits: 0, average_damage: 0, average_duration_minutes: 0, first_match_at: null, latest_match_at: null }, form: [], modes: [], heroes: [], positions: [], lanes: [], party: [], tempo: [], heroOptions: [], syncState: null, integrity: { linked: 0, complete: 0, missing_stats: 0, missing_match: 0 } },
    });
    const customRange = { ...DEFAULT_ARCHIVE_FILTERS, period: 'custom' as const, startDate: '2026-01-10', endDate: '2026-02-20' };
    await expect(fetchArchiveShowcaseOverview(client, 77, customRange)).resolves.toMatchObject({ account: { dotaAccountId: 77, personaName: 'Curated' } });
    expect(client.rpc).toHaveBeenCalledWith('get_archive_showcase_overview', expect.objectContaining({ p_dota_account_id: 77, p_period: 'custom', p_start_date: '2026-01-10', p_end_date: '2026-02-20' }));
    const missing = createFakeClient(null);
    await expect(fetchArchiveShowcasePage(missing, 77, customRange, null)).resolves.toBeNull();
  });

  it('resolves a public showcase alias and preserves null and RPC errors', async () => {
    const signal = new AbortController().signal;
    const client = createFakeClient(77);
    await expect(resolveArchiveShowcase(client, 'demo', signal)).resolves.toBe(77);
    expect(client.rpc).toHaveBeenCalledWith('resolve_archive_showcase', { p_slug: 'demo' });
    expect(client.abortSignal).toHaveBeenCalledWith(signal);

    await expect(resolveArchiveShowcase(createFakeClient(null), 'missing')).resolves.toBeNull();
    const failingClient = createFakeClient(null, { message: 'forbidden' });
    await expect(resolveArchiveShowcase(failingClient, 'demo')).rejects.toThrow('Could not open public archive: forbidden');
  });
});


function createFakeClient(data: unknown, error: { message: string } | null = null) {
  const abortSignal = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn(() => ({ abortSignal }));
  return { rpc, abortSignal } as unknown as Parameters<typeof fetchArchiveOverview>[0] & { rpc: typeof rpc; abortSignal: typeof abortSignal };
}
