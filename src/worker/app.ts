import { clerkMiddleware, getAuth } from '@clerk/hono';
import { Hono } from 'hono';
import type { SystemHealth } from '../shared/health';
import { checkSupabaseHealth } from './services/supabase-health';
import {
  loadHeroConstants,
  loadRecentMatches,
  OpenDotaError,
  resolveDotaPlayer,
} from './services/opendota';
import {
  MatchArchiveError,
  syncTrackedAccount,
} from './services/match-archive';
import {
  importPublicMatchDetail,
  syncTrackedMatchDetail,
} from './services/match-detail-archive';
import { StratzError } from './services/stratz';
import {
  resolveSteamProfileInput,
  SteamCommunityError,
} from './services/steam-community';
import { InvalidSteamIdError, parseDotaAccountId } from './services/steam-id';

type AppDependencies = {
  checkSupabase: typeof checkSupabaseHealth;
  loadRecentMatches: typeof loadRecentMatches;
  loadHeroConstants: typeof loadHeroConstants;
  syncTrackedAccount: typeof syncTrackedAccount;
  syncTrackedMatchDetail: typeof syncTrackedMatchDetail;
  importPublicMatchDetail: typeof importPublicMatchDetail;
  resolveDotaPlayer: typeof resolveDotaPlayer;
  resolveSteamProfileInput: typeof resolveSteamProfileInput;
};

const defaultDependencies: AppDependencies = {
  checkSupabase: checkSupabaseHealth,
  loadRecentMatches,
  loadHeroConstants,
  syncTrackedAccount,
  syncTrackedMatchDetail,
  importPublicMatchDetail,
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

  app.get('/api/dota/constants/heroes', async (context) => {
    const heroes = await dependencies.loadHeroConstants(context.env.OPENDOTA_BASE_URL);
    context.header('Cache-Control', 'public, max-age=86400');
    return context.json({ heroes });
  });

  app.use('/api/session', clerkMiddleware());
  app.get('/api/session', (context) => {
    const auth = getAuth(context);

    if (!auth.userId) {
      return context.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    return context.json({ userId: auth.userId });
  });

  app.use('/api/dota/*', clerkMiddleware());
  app.post('/api/dota/players/resolve', async (context) => {
    const auth = getAuth(context);
    if (!auth.userId) {
      return context.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const contentLength = Number(context.req.header('content-length') ?? 0);
    if (contentLength > 2_048) {
      return context.json({ error: 'Request body is too large', code: 'BODY_TOO_LARGE' }, 413);
    }

    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: 'Invalid JSON', code: 'INVALID_JSON' }, 400);
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('steamProfile' in payload) ||
      typeof payload.steamProfile !== 'string'
    ) {
      return context.json({ error: 'Steam profile is required', code: 'STEAM_PROFILE_REQUIRED' }, 400);
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
      return context.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    const accountId = parseDotaAccountId(context.req.param('accountId'));
    const matches = await dependencies.loadRecentMatches(
      context.env.OPENDOTA_BASE_URL,
      accountId,
    );

    context.header('Cache-Control', 'private, max-age=60');
    return context.json(matches);
  });

  app.post(
    '/api/dota/tracked-accounts/:trackedAccountId/matches/sync',
    async (context) => {
      const auth = getAuth(context);
      if (!auth.userId) {
        return context.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
      }

      const trackedAccountId = context.req.param('trackedAccountId');
      if (!isUuid(trackedAccountId)) {
        return context.json({ error: 'Invalid tracked account ID', code: 'INVALID_TRACKED_ACCOUNT_ID' }, 400);
      }

      const result = await dependencies.syncTrackedAccount(
        context.env,
        auth.userId,
        trackedAccountId,
      );

      return context.json(result);
    },
  );

  app.post('/api/dota/matches/:matchId/import', async (context) => {
    const auth = getAuth(context);
    if (!auth.userId) return context.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    const matchId = parseMatchId(context.req.param('matchId'));
    if (matchId === null) return context.json({ error: 'Invalid match ID', code: 'INVALID_MATCH_ID' }, 400);
    return context.json(await dependencies.importPublicMatchDetail(context.env, matchId));
  });

  app.post(
    '/api/dota/tracked-accounts/:trackedAccountId/matches/:matchId/details/sync',
    async (context) => {
      const auth = getAuth(context);
      if (!auth.userId) return context.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
      const trackedAccountId = context.req.param('trackedAccountId');
      if (!isUuid(trackedAccountId)) {
        return context.json({ error: 'Invalid tracked account ID', code: 'INVALID_TRACKED_ACCOUNT_ID' }, 400);
      }
      const matchId = parseMatchId(context.req.param('matchId'));
      if (matchId === null) {
        return context.json({ error: 'Invalid match ID', code: 'INVALID_MATCH_ID' }, 400);
      }
      return context.json(await dependencies.syncTrackedMatchDetail(
        context.env,
        auth.userId,
        trackedAccountId,
        matchId,
      ));
    },
  );

  app.notFound((context) => context.json({ error: 'Not found', code: 'NOT_FOUND' }, 404));
  app.onError((error, context) => {
    if (error instanceof InvalidSteamIdError) {
      return context.json({ error: error.message, code: error.code }, 400);
    }
    if (error instanceof OpenDotaError) {
      return context.json({ error: error.message, code: error.code }, error.statusCode);
    }
    if (error instanceof MatchArchiveError) {
      return context.json({ error: error.message, code: error.code }, error.statusCode);
    }
    if (error instanceof StratzError) {
      return context.json({ error: error.message, code: error.code }, error.statusCode);
    }
    if (error instanceof SteamCommunityError) {
      return context.json({ error: error.message, code: error.code }, error.statusCode);
    }

    console.error(
      JSON.stringify({
        message: 'Unhandled API error',
        error: error instanceof Error ? error.message : String(error),
        path: context.req.path,
      }),
    );

    return context.json({ error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' }, 500);
  });

  return app;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function parseMatchId(value: string): number | null {
  if (!/^\d{1,16}$/.test(value)) return null;
  const matchId = Number(value);
  return Number.isSafeInteger(matchId) && matchId > 0 ? matchId : null;
}
