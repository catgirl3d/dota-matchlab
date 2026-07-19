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
    const loadDetail = vi.fn().mockResolvedValue({
      unavailable: false,
      error: null,
      payloads: [{ section: 'players', response: { data: { match: { id: 9_001 } } } }],
    });

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
  });

  it('persists an explicitly requested public match', async () => {
    const client = {
      claimSpecificMatchDetail: vi.fn(), applyMatchDetailBatch: vi.fn(),
      applyPublicMatchImport: vi.fn().mockResolvedValue({ data: { status: 'available' }, error: null }),
    };
    const loadDetail = vi.fn().mockResolvedValue({ unavailable: false, error: null, payloads: [{ section: 'players', response: { data: { match: { id: 9001, gameMode: 'TURBO', lobbyType: 'UNRANKED', radiantKills: 30, direKills: 20, players: [] } } } }] });
    await expect(importPublicMatchDetail(env, 9001, { createClient: () => client, loadDetail })).resolves.toEqual({ matchId: 9001, status: 'available', imported: true });
    expect(client.applyPublicMatchImport).toHaveBeenCalledWith(expect.objectContaining({ p_match_id: 9001, p_result: expect.objectContaining({ status: 'available', normalized_match: expect.objectContaining({ match_id: 9001, game_mode: 23, radiant_score: 30 }) }) }));
  });

  it('returns unavailable without writing placeholder state', async () => {
    const client = { claimSpecificMatchDetail: vi.fn(), applyMatchDetailBatch: vi.fn(), applyPublicMatchImport: vi.fn() };
    const loadDetail = vi.fn().mockResolvedValue({ unavailable: true, error: null, payloads: [] });
    await expect(importPublicMatchDetail(env, 9001, { createClient: () => client, loadDetail })).resolves.toEqual({ matchId: 9001, status: 'unavailable', imported: false });
    expect(client.applyPublicMatchImport).not.toHaveBeenCalled();
  });

  it('rejects a mismatched provider payload without writing it', async () => {
    const client = { claimSpecificMatchDetail: vi.fn(), applyMatchDetailBatch: vi.fn(), applyPublicMatchImport: vi.fn() };
    const loadDetail = vi.fn().mockResolvedValue({ unavailable: false, error: null, payloads: [{ section: 'players', response: { data: { match: { id: 9002, players: [{ matchId: 9002 }] } } } }] });
    await expect(importPublicMatchDetail(env, 9001, { createClient: () => client, loadDetail })).rejects.toThrow('another match');
    expect(client.applyPublicMatchImport).not.toHaveBeenCalled();
  });

  it('does not persist partial sections when provider loading fails', async () => {
    const client = { claimSpecificMatchDetail: vi.fn(), applyMatchDetailBatch: vi.fn(), applyPublicMatchImport: vi.fn() };
    const loadDetail = vi.fn().mockResolvedValue({ unavailable: false, error: new StratzError('section failed', 502), payloads: [{ section: 'players', response: { data: { match: { id: 9001 } } } }] });
    await expect(importPublicMatchDetail(env, 9001, { createClient: () => client, loadDetail })).rejects.toThrow('section failed');
    expect(client.applyPublicMatchImport).not.toHaveBeenCalled();
  });
});
