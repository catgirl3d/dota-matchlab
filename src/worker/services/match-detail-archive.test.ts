import { describe, expect, it, vi } from 'vitest';
import { syncTrackedMatchDetail } from './match-detail-archive';

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
});
