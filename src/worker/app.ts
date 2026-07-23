import { clerkMiddleware, getAuth } from '@clerk/hono';
import * as v from 'valibot';
import { Hono, type MiddlewareHandler } from 'hono';
import {
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
import { InvalidSteamIdError } from './services/steam-id';

type AppDependencies = {
  syncTrackedAccount: typeof syncTrackedAccount;
  syncTrackedMatchDetail: typeof syncTrackedMatchDetail;
  importPublicMatchDetail: typeof importPublicMatchDetail;
  resolveDotaPlayer: typeof resolveDotaPlayer;
  resolveSteamProfileInput: typeof resolveSteamProfileInput;
  getAuth: typeof getAuth;
};

type AppEnvironment = {
  Bindings: Env;
  Variables: {
    userId: string;
  };
};

const ResolvePlayerBodySchema = v.object({
  steamProfile: v.pipe(v.string(), v.minLength(1)),
});

const defaultDependencies: AppDependencies = {
  syncTrackedAccount,
  syncTrackedMatchDetail,
  importPublicMatchDetail,
  resolveDotaPlayer,
  resolveSteamProfileInput,
  getAuth,
};

export function createApp(overrides: Partial<AppDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const app = new Hono<AppEnvironment>();
  const requireAuth: MiddlewareHandler<AppEnvironment> = async (context, next) => {
    const { userId } = dependencies.getAuth(context);

    if (!userId) {
      return context.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }

    context.set('userId', userId);
    await next();
  };

  app.get('/api/health/live', (context) =>
    context.json({ status: 'ok' as const }),
  );

  app.use('/api/session', clerkMiddleware());
  app.get('/api/session', requireAuth, (context) =>
    context.json({ userId: context.get('userId') }),
  );

  app.use('/api/dota/*', clerkMiddleware());
  app.post('/api/dota/players/resolve', requireAuth, async (context) => {
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

    const parsedPayload = v.safeParse(ResolvePlayerBodySchema, payload);
    if (!parsedPayload.success) {
      return context.json({ error: 'Steam profile is required', code: 'STEAM_PROFILE_REQUIRED' }, 400);
    }

    const steamId64 = await dependencies.resolveSteamProfileInput(
      parsedPayload.output.steamProfile,
    );
    const profile = await dependencies.resolveDotaPlayer(
      context.env.OPENDOTA_BASE_URL,
      steamId64,
    );

    return context.json(profile);
  });

  app.post(
    '/api/dota/tracked-accounts/:trackedAccountId/matches/sync',
    requireAuth,
    async (context) => {
      const trackedAccountId = context.req.param('trackedAccountId');
      if (!isUuid(trackedAccountId)) {
        return context.json({ error: 'Invalid tracked account ID', code: 'INVALID_TRACKED_ACCOUNT_ID' }, 400);
      }

      const result = await dependencies.syncTrackedAccount(
        context.env,
        context.get('userId'),
        trackedAccountId,
      );

      return context.json(result);
    },
  );

  app.post('/api/dota/matches/:matchId/import', requireAuth, async (context) => {
    const matchId = parseMatchId(context.req.param('matchId'));
    if (matchId === null) return context.json({ error: 'Invalid match ID', code: 'INVALID_MATCH_ID' }, 400);
    return context.json(await dependencies.importPublicMatchDetail(context.env, matchId));
  });

  app.post(
    '/api/dota/tracked-accounts/:trackedAccountId/matches/:matchId/details/sync',
    requireAuth,
    async (context) => {
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
        context.get('userId'),
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
