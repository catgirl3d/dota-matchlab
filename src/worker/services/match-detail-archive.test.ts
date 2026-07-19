import { describe, expect, it, vi } from 'vitest';
import { syncTrackedAccountDetails } from './match-detail-archive';
import { StratzError } from './stratz';

const env: Env = {
  CLERK_PUBLISHABLE_KEY: 'pk_test', CLERK_SECRET_KEY: 'sk_test',
  OPENDOTA_BASE_URL: 'https://api.opendota.com/api',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable', SUPABASE_SERVICE_ROLE_KEY: 'sb_service',
  SUPABASE_URL: 'https://example.supabase.co', STRATZ_API_TOKEN: 'stratz-token',
};

describe('STRATZ detail archive', () => {
  it('persists successful details while isolating a failed match', async () => {
    const client = {
      claimMatchDetailBatch: vi.fn().mockResolvedValue({ data: {
        owned: true, claimed: true, dotaAccountId: 123, leaseToken: 'lease',
        matchIds: [9001, 9000], backfillComplete: false,
      }, error: null }),
      applyMatchDetailBatch: vi.fn().mockResolvedValue({ data: {
        processedMatches: 2, backfillComplete: false,
      }, error: null }),
    };
    const loadDetail = vi.fn()
      .mockResolvedValueOnce({
        unavailable: false,
        error: null,
        payloads: [{
          section: 'player_stats',
          response: { data: { match: { id: 9001, players: [{ stats: { goldPerMinute: [100] } }] } } },
        }],
      })
      .mockRejectedValueOnce(new StratzError('rate limited', 429));

    await expect(syncTrackedAccountDetails(env, 'user-a', '00000000-0000-0000-0000-000000000202', {
      createClient: () => client,
      loadDetail,
    })).resolves.toEqual({
      accountId: 123, processedMatches: 2, availableMatches: 1, failedMatches: 1, backfillComplete: false,
    });

    expect(client.applyMatchDetailBatch).toHaveBeenCalledWith(expect.objectContaining({
      p_results: [
        expect.objectContaining({ match_id: 9001, status: 'available', payloads: [expect.objectContaining({ payload_section: 'player_stats' })] }),
        expect.objectContaining({ match_id: 9000, status: 'failed', error_code: 'STRATZ_429' }),
      ],
    }));
  });
});
