import { describe, expect, it, vi } from 'vitest';
import { importPublicMatchDetail, syncTrackedMatchDetail } from './match-detail-archive';
import { StratzError } from './stratz';

const env: Env = {
  CLERK_PUBLISHABLE_KEY: 'pk_test', CLERK_SECRET_KEY: 'sk_test',
  OPENDOTA_BASE_URL: 'https://api.opendota.com/api',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable', SUPABASE_SERVICE_ROLE_KEY: 'sb_service',
  SUPABASE_URL: 'https://example.supabase.co', STRATZ_API_TOKEN: 'stratz-token',
};

describe('STRATZ detail archive', () => {
  it('claims and parses one explicitly selected match', async () => {
    const client = {
      claimSpecificMatchDetail: vi.fn().mockResolvedValue({
        data: {
          owned: true,
          claimed: true,
          status: 'syncing',
          dotaAccountId: 123,
          leaseToken: 'specific-lease',
          matchIds: [9_001],
          backfillComplete: false,
        },
        error: null,
      }),
      applyMatchDetailBatch: vi.fn().mockResolvedValue({
        data: { processedMatches: 1, backfillComplete: false },
        error: null,
      }),
      applyPublicMatchImport: vi.fn(),
    };
    const loadDetail = vi.fn().mockResolvedValue(availableDetail(9_001));

    await expect(
      syncTrackedMatchDetail(
        env,
        'user-a',
        '00000000-0000-0000-0000-000000000202',
        9_001,
        { createClient: () => client, loadDetail },
      ),
    ).resolves.toEqual({
      accountId: 123,
      processedMatches: 1,
      availableMatches: 1,
      failedMatches: 0,
      backfillComplete: false,
    });

    expect(client.claimSpecificMatchDetail).toHaveBeenCalledWith(
      expect.objectContaining({ p_match_id: 9_001 }),
    );
    expect(loadDetail).toHaveBeenCalledWith('stratz-token', 9_001);
    expect(client.applyMatchDetailBatch).toHaveBeenCalledWith(expect.objectContaining({
      p_results: [expect.objectContaining({
        match_id: 9_001,
        status: 'available',
        normalized_players: [expect.objectContaining({
          match_id: 9_001,
          account_id: 77,
          gold_per_min: 700,
        })],
      })],
    }));
  });

  it('persists an explicitly requested public match', async () => {
    const client = {
      claimSpecificMatchDetail: vi.fn(), applyMatchDetailBatch: vi.fn(),
      applyPublicMatchImport: vi.fn().mockResolvedValue({ data: { match_id: 9001, status: 'available' }, error: null }),
    };
    const loadDetail = vi.fn().mockResolvedValue(availableDetail(9001));
    await expect(importPublicMatchDetail(env, 9001, { createClient: () => client, loadDetail })).resolves.toEqual({ matchId: 9001, status: 'available', imported: true });
    expect(client.applyPublicMatchImport).toHaveBeenCalledWith(expect.objectContaining({
      p_match_id: 9001,
      p_result: expect.objectContaining({
        status: 'available',
        normalized_match: expect.objectContaining({ match_id: 9001, game_mode: 23, radiant_score: 30 }),
        normalized_players: [expect.objectContaining({ match_id: 9001, account_id: 77 })],
      }),
    }));
  });

  it('returns unavailable without writing placeholder state', async () => {
    const client = { claimSpecificMatchDetail: vi.fn(), applyMatchDetailBatch: vi.fn(), applyPublicMatchImport: vi.fn() };
    const loadDetail = vi.fn().mockResolvedValue({ unavailable: true, error: null, payloads: [] });
    await expect(importPublicMatchDetail(env, 9001, { createClient: () => client, loadDetail })).resolves.toEqual({ matchId: 9001, status: 'unavailable', imported: false });
    expect(client.applyPublicMatchImport).not.toHaveBeenCalled();
  });

  it('returns an idempotent unclaimed empty detail response without provider work', async () => {
    const client = claimedClient();
    client.claimSpecificMatchDetail.mockResolvedValueOnce({
      data: { owned: true, claimed: false, status: 'available', dotaAccountId: 123, matchIds: [], backfillComplete: true },
      error: null,
    });
    const loadDetail = vi.fn();

    await expect(syncTrackedMatchDetail(
      env,
      'user-a',
      '00000000-0000-0000-0000-000000000202',
      9001,
      { createClient: () => client, loadDetail },
    )).resolves.toEqual({
      accountId: 123,
      processedMatches: 0,
      availableMatches: 1,
      failedMatches: 0,
      backfillComplete: true,
    });

    expect(loadDetail).not.toHaveBeenCalled();
    expect(client.applyMatchDetailBatch).not.toHaveBeenCalled();
  });

  it('rejects unclaimed detail IDs before provider or apply work', async () => {
    const client = claimedClient();
    client.claimSpecificMatchDetail.mockResolvedValueOnce({
      data: { owned: true, claimed: false, status: 'syncing', dotaAccountId: 123, leaseToken: 'invalid', matchIds: [9001], backfillComplete: false },
      error: null,
    });
    const loadDetail = vi.fn();

    await expect(syncTrackedMatchDetail(
      env,
      'user-a',
      '00000000-0000-0000-0000-000000000202',
      9001,
      { createClient: () => client, loadDetail },
    )).rejects.toThrow('invalid claim response');

    expect(loadDetail).not.toHaveBeenCalled();
    expect(client.applyMatchDetailBatch).not.toHaveBeenCalled();
  });

  it('rejects a mismatched public provider payload without writing it', async () => {
    const client = { claimSpecificMatchDetail: vi.fn(), applyMatchDetailBatch: vi.fn(), applyPublicMatchImport: vi.fn() };
    const loadDetail = vi.fn().mockResolvedValue(availableDetail(9002));
    await expect(importPublicMatchDetail(env, 9001, { createClient: () => client, loadDetail })).rejects.toThrow('another match');
    expect(client.applyPublicMatchImport).not.toHaveBeenCalled();
  });

  it('records a tracked identity mismatch as failed without an available canonical result', async () => {
    const client = claimedClient();
    const loadDetail = vi.fn().mockResolvedValue(availableDetail(9002));

    await expect(syncTrackedMatchDetail(
      env,
      'user-a',
      '00000000-0000-0000-0000-000000000202',
      9001,
      { createClient: () => client, loadDetail },
    )).resolves.toMatchObject({ availableMatches: 0, failedMatches: 1 });

    expect(client.applyMatchDetailBatch).toHaveBeenCalledWith(expect.objectContaining({
      p_results: [expect.not.objectContaining({ normalized_players: expect.anything() })],
    }));
  });

  it('records missing tracked projectable players as failed', async () => {
    const client = claimedClient();
    const loadDetail = vi.fn().mockResolvedValue(availableDetail(9001, []));

    await expect(syncTrackedMatchDetail(
      env,
      'user-a',
      '00000000-0000-0000-0000-000000000202',
      9001,
      { createClient: () => client, loadDetail },
    )).resolves.toMatchObject({ availableMatches: 0, failedMatches: 1 });

    expect(client.applyMatchDetailBatch).toHaveBeenCalledWith(expect.objectContaining({
      p_results: [expect.objectContaining({ match_id: 9001, status: 'failed' })],
    }));
  });

  it('rejects malformed detail apply responses after loading provider data', async () => {
    const client = claimedClient();
    client.applyMatchDetailBatch.mockResolvedValueOnce({
      data: { processedMatches: 'one', backfillComplete: false },
      error: null,
    });
    const loadDetail = vi.fn().mockResolvedValue(availableDetail(9001));

    await expect(syncTrackedMatchDetail(
      env,
      'user-a',
      '00000000-0000-0000-0000-000000000202',
      9001,
      { createClient: () => client, loadDetail },
    )).rejects.toThrow('invalid response');
  });

  it('rejects missing public projectable players without writing it', async () => {
    const client = { claimSpecificMatchDetail: vi.fn(), applyMatchDetailBatch: vi.fn(), applyPublicMatchImport: vi.fn() };
    const loadDetail = vi.fn().mockResolvedValue(availableDetail(9001, []));

    await expect(importPublicMatchDetail(env, 9001, { createClient: () => client, loadDetail })).rejects.toThrow('no projectable players');
    expect(client.applyPublicMatchImport).not.toHaveBeenCalled();
  });

  it('does not persist partial sections when provider loading fails', async () => {
    const client = { claimSpecificMatchDetail: vi.fn(), applyMatchDetailBatch: vi.fn(), applyPublicMatchImport: vi.fn() };
    const loadDetail = vi.fn().mockResolvedValue({ unavailable: false, error: new StratzError('section failed', 502, 'STRATZ_SECTION_FAILED'), payloads: [{ section: 'players', response: { data: { match: { id: 9001 } } } }] });
    await expect(importPublicMatchDetail(env, 9001, { createClient: () => client, loadDetail })).rejects.toThrow('section failed');
    expect(client.applyPublicMatchImport).not.toHaveBeenCalled();
  });

  it('sends failed and unavailable tracked results without normalized players', async () => {
    const client = claimedClient();
    const loadDetail = vi.fn()
      .mockResolvedValueOnce({ unavailable: true, error: null, payloads: [] })
      .mockResolvedValueOnce({ unavailable: false, error: new StratzError('section failed', 502, 'STRATZ_SECTION_FAILED'), payloads: [] });
    client.claimSpecificMatchDetail.mockResolvedValueOnce({
      data: { owned: true, claimed: true, status: 'syncing', dotaAccountId: 123, leaseToken: 'specific-lease', matchIds: [9001, 9002], backfillComplete: false },
      error: null,
    });

    await expect(syncTrackedMatchDetail(
      env,
      'user-a',
      '00000000-0000-0000-0000-000000000202',
      9001,
      { createClient: () => client, loadDetail },
    )).resolves.toMatchObject({ availableMatches: 0, failedMatches: 1 });

    expect(client.applyMatchDetailBatch).toHaveBeenCalledWith(expect.objectContaining({
      p_results: [
        { match_id: 9001, status: 'unavailable' },
        expect.objectContaining({ match_id: 9002, status: 'failed' }),
      ],
    }));
  });
});

function availableDetail(matchId: number, players = [{
  matchId,
  steamAccountId: 77,
  playerSlot: 0,
  heroId: 1,
  kills: 9,
  goldPerMinute: 700,
  leaverStatus: 'NONE',
}]) {
  return {
    unavailable: false,
    error: null,
    payloads: [{
      section: 'players',
      response: {
        data: {
          match: {
            id: matchId,
            gameMode: 'TURBO',
            lobbyType: 'UNRANKED',
            radiantKills: 30,
            direKills: 20,
            players,
          },
        },
      },
    }],
  };
}

function claimedClient() {
  return {
    claimSpecificMatchDetail: vi.fn().mockResolvedValue({
      data: {
        owned: true,
        claimed: true,
        status: 'syncing',
        dotaAccountId: 123,
        leaseToken: 'specific-lease',
        matchIds: [9001],
        backfillComplete: false,
      },
      error: null,
    }),
    applyMatchDetailBatch: vi.fn().mockResolvedValue({
      data: { processedMatches: 1, backfillComplete: false },
      error: null,
    }),
    applyPublicMatchImport: vi.fn(),
  };
}
