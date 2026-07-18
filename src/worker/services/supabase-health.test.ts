import { describe, expect, it, vi } from 'vitest';
import { checkSupabaseHealth } from './supabase-health';

describe('checkSupabaseHealth', () => {
  it('does not call the network when configuration is absent', async () => {
    const fetcher = vi.fn<typeof fetch>();

    const result = await checkSupabaseHealth(
      { SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' },
      fetcher,
    );

    expect(result).toEqual({ status: 'not_configured', latencyMs: 0 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('accepts the narrow health RPC response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ status: 'ok' }));

    const result = await checkSupabaseHealth(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      },
      fetcher,
    );

    expect(result.status).toBe('ok');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0].toString()).toBe(
      'https://example.supabase.co/rest/v1/rpc/app_healthcheck',
    );
  });

  it('does not expose an upstream error body', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('sensitive upstream detail', { status: 401 }));

    const result = await checkSupabaseHealth(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'wrong-key',
      },
      fetcher,
    );

    expect(result).toMatchObject({ status: 'error', statusCode: 401 });
    expect(result).not.toHaveProperty('error');
  });
});
