import type { SupabaseHealth } from '../../shared/health';

type SupabaseHealthEnv = Pick<
  Env,
  'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY'
>;

const HEALTH_TIMEOUT_MS = 5_000;

export async function checkSupabaseHealth(
  env: SupabaseHealthEnv,
  fetcher: typeof fetch = fetch,
): Promise<SupabaseHealth> {
  const startedAt = Date.now();

  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return { status: 'not_configured', latencyMs: 0 };
  }

  let endpoint: URL;
  try {
    endpoint = new URL('/rest/v1/rpc/app_healthcheck', env.SUPABASE_URL);
  } catch {
    return { status: 'error', latencyMs: 0 };
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: abortController.signal,
    });

    if (!response.ok) {
      await response.body?.cancel();
      return {
        status: 'error',
        latencyMs: Date.now() - startedAt,
        statusCode: response.status,
      };
    }

    const payload: unknown = await response.json();
    const isHealthy =
      typeof payload === 'object' &&
      payload !== null &&
      'status' in payload &&
      payload.status === 'ok';

    return {
      status: isHealthy ? 'ok' : 'error',
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    return {
      status: 'error',
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}
