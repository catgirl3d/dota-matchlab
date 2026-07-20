import { SignInButton, useAuth, useSession } from '@clerk/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate, useOutletContext, Outlet, useParams } from 'react-router';
import type { ComponentProps } from 'react';
import type { Tables } from '../../shared/database.types';
import { fetchHeroNames, importMatch, syncTrackedMatchDetail } from '../lib/dota-api';
import { parseMatchId } from '../lib/match-id';
import { fetchMatchDetail } from '../lib/match-detail';
import { createPublicSupabaseClient, createUserSupabaseClient } from '../lib/supabase';
import { archiveQueryKeys } from '../lib/archive-query-keys';
import { MatchDetailView } from './MatchDetailView';
import { useTranslation } from '../lib/i18n';


type TrackedAccount = Pick<Tables<'tracked_accounts'>, 'id' | 'dota_account_id'>;

const trackedAccountFields = 'id,dota_account_id' as const;

type MatchRouteContext = {
  detailProps: ComponentProps<typeof MatchDetailView>;
  onImport: () => void;
  canImport: boolean;
  canSignIn: boolean;
  isUnavailable: boolean;
  archivePath: string;
  backLabel: string;
};

type MatchRouteLayoutProps = {
  authEnabled?: boolean;
};

type MatchRouteDataProps = {
  matchId: number;
  userId: string | null;
  getToken: (() => Promise<string | null>) | null;
  canSignIn: boolean;
};

export function MatchRouteLayout({ authEnabled = true }: MatchRouteLayoutProps) {
  const { matchId: matchIdParam } = useParams();
  const matchId = parseMatchId(matchIdParam);
  const { t } = useTranslation();

  if (matchId === null) {
    return <RouteError text={t('invalidMatchId')} />;
  }

  return authEnabled
    ? <ClerkMatchRouteData matchId={matchId} />
    : <MatchRouteData matchId={matchId} userId={null} getToken={null} canSignIn={false} />;
}

function ClerkMatchRouteData({ matchId }: { matchId: number }) {
  const { session } = useSession();
  const { userId } = useAuth();
  return (
    <MatchRouteData
      matchId={matchId}
      userId={userId ?? null}
      getToken={session ? () => session.getToken() : null}
      canSignIn
    />
  );
}

function MatchRouteData({ matchId, userId, getToken, canSignIn }: MatchRouteDataProps) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const playerId = parseMatchId(searchParams.get('player'));
  const isSignedIn = Boolean(userId && getToken);

  const perspectiveAccountQuery = useQuery({
    queryKey: ['match-route-player-perspective', userId, playerId],
    enabled: isSignedIn && playerId !== null,
    queryFn: async (): Promise<TrackedAccount | null> => {
      if (!getToken || playerId === null) throw new Error('Player perspective is not available');
      const supabase = createUserSupabaseClient(getToken);
      const { data, error } = await supabase
        .from('tracked_accounts')
        .select(trackedAccountFields)
        .eq('dota_account_id', playerId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.dota_account_id === playerId
        ? { ...data, dota_account_id: data.dota_account_id }
        : null;
    },
  });
  const perspectiveAccount = perspectiveAccountQuery.data ?? null;

  const heroNamesQuery = useQuery({
    queryKey: ['dota-hero-names'],
    staleTime: 86_400_000,
    gcTime: 86_400_000,
    queryFn: () => fetchHeroNames(),
  });
  const matchDetailQuery = useQuery({
    queryKey: ['match-detail', matchId],
    staleTime: 300_000,
    queryFn: () => fetchMatchDetail(createPublicSupabaseClient(), matchId),
  });
  const linkedAccountQuery = useQuery({
    queryKey: ['match-linked-account', userId, matchId],
    enabled: isSignedIn,
    queryFn: async () => {
      if (!getToken) return null;
      const supabase = createUserSupabaseClient(getToken);
      const { data, error } = await supabase
        .from('tracked_account_matches')
        .select('tracked_account_id')
        .eq('match_id', matchId)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.tracked_account_id ?? null;
    },
  });
  const matchDetailSync = useMutation({
    mutationFn: async ({ trackedAccountId, detailMatchId }: { trackedAccountId: string; detailMatchId: number }) => {
      if (!getToken) throw new Error('Clerk session is not ready');
      const token = await getToken();
      if (!token) throw new Error('Failed to retrieve Clerk JWT');
      return syncTrackedMatchDetail(token, trackedAccountId, detailMatchId);
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['match-detail', variables.detailMatchId] });
      void queryClient.invalidateQueries({ queryKey: archiveQueryKeys.root(variables.trackedAccountId) });
    },
  });
  const publicImport = useMutation({
    mutationFn: async (detailMatchId: number) => {
      if (!getToken) throw new Error('Clerk session is not ready');
      const token = await getToken();
      if (!token) throw new Error('Failed to retrieve Clerk JWT');
      return importMatch(token, detailMatchId);
    },
    onSuccess: (_result, detailMatchId) => {
      void queryClient.invalidateQueries({ queryKey: ['match-detail', detailMatchId] });
      if (perspectiveAccount) {
        void queryClient.invalidateQueries({ queryKey: archiveQueryKeys.root(perspectiveAccount.id) });
      }
    },
  });

  const { t } = useTranslation();

  const isPublicImportForMatch = publicImport.variables === matchId;
  const isTrackedSyncForMatch = matchDetailSync.variables?.detailMatchId === matchId;
  const detailProps: ComponentProps<typeof MatchDetailView> = {
    detail: matchDetailQuery.data ?? undefined,
    heroNames: heroNamesQuery.data ?? {},
    currentAccountId: perspectiveAccount && matchDetailQuery.data?.players.some(
      (player) => player.accountId === perspectiveAccount.dota_account_id,
    ) ? perspectiveAccount.dota_account_id : null,
    isLoading: matchDetailQuery.isPending,
    error: matchDetailQuery.error,
    parseError: matchDetailQuery.data && linkedAccountQuery.error
      ? linkedAccountQuery.error
      : isTrackedSyncForMatch
        ? matchDetailSync.error
        : isPublicImportForMatch
          ? publicImport.error
          : null,
    isParsing: (isTrackedSyncForMatch && matchDetailSync.isPending)
      || (isPublicImportForMatch && publicImport.isPending)
      || (isSignedIn && Boolean(matchDetailQuery.data) && linkedAccountQuery.isFetching),
    parseDisabledReason: isSignedIn ? null : t('parseDisabledReason'),
    backLabel: isSignedIn ? t('backToArchive') : playerId === null ? t('backToHome') : t('backToPublicArchive'),
    onBack: () => undefined,
    onRefresh: () => void matchDetailQuery.refetch(),
    onParse: () => {
      if (!isSignedIn) {
        return;
      } else if (linkedAccountQuery.isError) {
        void linkedAccountQuery.refetch();
      } else if (linkedAccountQuery.data) {
        matchDetailSync.mutate({ trackedAccountId: linkedAccountQuery.data, detailMatchId: matchId });
      } else {
        publicImport.mutate(matchId);
      }
    },
  };

  return (
    <Outlet context={{
      detailProps,
      onImport: () => publicImport.mutate(matchId),
      canImport: isSignedIn,
      canSignIn,
      isUnavailable: isPublicImportForMatch && publicImport.data?.status === 'unavailable',
      archivePath: isSignedIn
        ? playerId === null ? '/archive' : `/archive?player=${playerId}`
        : playerId === null ? '/' : `/archive?player=${playerId}`,
      backLabel: isSignedIn ? t('backToArchive') : playerId === null ? t('backToHome') : t('backToPublicArchive'),
    } satisfies MatchRouteContext}
    />
  );
}

export function MatchDetailRoute() {
  const navigate = useNavigate();
  const { detailProps, onImport, canImport, canSignIn, isUnavailable, archivePath, backLabel } = useOutletContext<MatchRouteContext>();
  const navigateToArchive = () => navigate(archivePath, { replace: true });
  const { t } = useTranslation();

  if (detailProps.isLoading || detailProps.detail || detailProps.error) {
    return <MatchDetailView {...detailProps} onBack={navigateToArchive} />;
  }
  return (
    <section className="workspace-message workspace-message--neutral">
      <span aria-hidden="true">+</span>
      <p>{isUnavailable ? t('matchUnavailable') : t('matchNotLoaded')}</p>
      <div className="workspace-message__actions">
        {canImport ? (
          <button className="workspace-message__button workspace-message__button--primary" type="button" onClick={onImport} disabled={detailProps.isParsing}>
            {detailProps.isParsing ? t('loadingMatchDetails') : t('loadMatchFromStratz')}
          </button>
        ) : canSignIn ? (
          <SignInButton mode="modal">
            <button className="workspace-message__button workspace-message__button--primary" type="button">
              {t('signInToLoadMatch')}
            </button>
          </SignInButton>
        ) : null}
        <button className="workspace-message__button workspace-message__button--secondary" type="button" onClick={navigateToArchive}>
          {backLabel}
        </button>
      </div>
      {detailProps.parseError ? <p className="form-error">{detailProps.parseError.message}</p> : null}
    </section>
  );
}

export function RouteError({ text }: { text: string }) {
  return <div className="workspace-message workspace-message--error"><span aria-hidden="true">!</span><p>{text}</p></div>;
}
