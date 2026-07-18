import { clerkMiddleware, getAuth } from '@clerk/hono';
import { Hono } from 'hono';
import type { SystemHealth } from '../shared/health';
import { checkSupabaseHealth } from './services/supabase-health';
import { loadRecentMatches, OpenDotaError, resolveDotaPlayer } from './services/opendota';
import {
  resolveSteamProfileInput,
  SteamCommunityError,
} from './services/steam-community';
import { InvalidSteamIdError, parseDotaAccountId } from './services/steam-id';

type AppDependencies = {
  checkSupabase: typeof checkSupabaseHealth;
  loadRecentMatches: typeof loadRecentMatches;
  resolveDotaPlayer: typeof resolveDotaPlayer;
  resolveSteamProfileInput: typeof resolveSteamProfileInput;
};

const defaultDependencies: AppDependencies = {
  checkSupabase: checkSupabaseHealth,
  loadRecentMatches,
  resolveDotaPlayer,
  resolveSteamProfileInput,
};

export function createApp(overrides: Partial<AppDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const app = new Hono<{ Bindings: Env }>();

  app.get('/api/health/live', (context) =>
    context.json({ status: 'ok' as const }),
  );

  app.get('/api/health', async (context) => {
    const supabase = await dependencies.checkSupabase(context.env);
    const status = supabase.status === 'ok' ? 'ok' : 'degraded';
    const response: SystemHealth = {
      status,
      checkedAt: new Date().toISOString(),
      services: {
        worker: 'ok',
        supabase,
      },
    };

    return context.json(response, status === 'ok' ? 200 : 503);
  });

  app.use('/api/session', clerkMiddleware());
  app.get('/api/session', (context) => {
    const auth = getAuth(context);

    if (!auth.userId) {
      return context.json({ error: 'Unauthorized' }, 401);
    }

    return context.json({ userId: auth.userId });
  });

  app.use('/api/dota/*', clerkMiddleware());
  app.post('/api/dota/players/resolve', async (context) => {
    const auth = getAuth(context);
    if (!auth.userId) {
      return context.json({ error: 'Unauthorized' }, 401);
    }

    const contentLength = Number(context.req.header('content-length') ?? 0);
    if (contentLength > 2_048) {
      return context.json({ error: 'Request body is too large' }, 413);
    }

    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: 'Некорректный JSON' }, 400);
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('steamProfile' in payload) ||
      typeof payload.steamProfile !== 'string'
    ) {
      return context.json({ error: 'Steam-профиль обязателен' }, 400);
    }

    const steamId64 = await dependencies.resolveSteamProfileInput(
      payload.steamProfile,
    );
    const profile = await dependencies.resolveDotaPlayer(
      context.env.OPENDOTA_BASE_URL,
      steamId64,
    );

    return context.json(profile);
  });

  app.get('/api/dota/players/:accountId/recent-matches', async (context) => {
    const auth = getAuth(context);
    if (!auth.userId) {
      return context.json({ error: 'Unauthorized' }, 401);
    }

    const accountId = parseDotaAccountId(context.req.param('accountId'));
    const matches = await dependencies.loadRecentMatches(
      context.env.OPENDOTA_BASE_URL,
      accountId,
    );

    context.header('Cache-Control', 'private, max-age=60');
    return context.json(matches);
  });

  app.notFound((context) => context.json({ error: 'Not found' }, 404));
  app.onError((error, context) => {
    if (error instanceof InvalidSteamIdError) {
      return context.json({ error: error.message }, 400);
    }
    if (error instanceof OpenDotaError) {
      return context.json({ error: error.message }, error.statusCode);
    }
    if (error instanceof SteamCommunityError) {
      return context.json({ error: error.message }, error.statusCode);
    }

    console.error(
      JSON.stringify({
        message: 'Unhandled API error',
        error: error instanceof Error ? error.message : String(error),
        path: context.req.path,
      }),
    );

    return context.json({ error: 'Internal server error' }, 500);
  });

  return app;
}
