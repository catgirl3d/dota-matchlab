import { useAuth, useSession } from '@clerk/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { Tables } from '../../shared/database.types';
import type { MatchSyncResult } from '../../shared/match-archive';
import {
  fetchArchiveOverview,
  fetchArchivePage,
  type ArchiveCursor,
  type ArchiveOverview,
  type ArchivePage,
} from '../lib/archive';
import { DEFAULT_ARCHIVE_FILTERS, type ArchiveFilters } from '../lib/archive-analytics';
import { ARCHIVE_STALE_TIME_MS, archiveQueryKeys } from '../lib/archive-query-keys';
import {
  fetchHeroNames,
  resolveSteamProfile,
  syncAllTrackedAccount,
  syncTrackedAccount,
  type MatchSyncProgress,
} from '../lib/dota-api';
import { parseMatchId } from '../lib/match-id';
import { createUserSupabaseClient } from '../lib/supabase';
import { ArchiveShowcase } from './ArchiveShowcase';
import { PlayerDashboard } from './PlayerDashboard';
import { useTranslation } from '../lib/i18n';

type TrackedAccount = Pick<
  Tables<'tracked_accounts'>,
  | 'id'
  | 'steam_id64'
  | 'persona_name'
  | 'avatar_url'
  | 'rank_tier'
  | 'profile_refreshed_at'
> & { dota_account_id: number };

const trackedAccountFields =
  'id,steam_id64,dota_account_id,persona_name,avatar_url,rank_tier,profile_refreshed_at' as const;
const TRACKED_ACCOUNTS_STALE_TIME_MS = 20 * 60_000;

function keepArchiveDataForSameAccount<T>(
  previousData: T | undefined,
  previousQuery: { queryKey: readonly unknown[] } | undefined,
  accountId: string | undefined,
): T | undefined {
  return previousQuery?.queryKey[1] === accountId ? previousData : undefined;
}

export function MatchWorkspace() {
  const { t } = useTranslation();
  const { session } = useSession();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [steamProfile, setSteamProfile] = useState('');
  const [archiveSyncProgress, setArchiveSyncProgress] =
    useState<MatchSyncProgress | null>(null);
  const [archiveSyncMode, setArchiveSyncMode] = useState<'page' | 'all' | null>(null);
  const [archiveFilters, setArchiveFilters] = useState<ArchiveFilters>(DEFAULT_ARCHIVE_FILTERS);
  const [archiveCursors, setArchiveCursors] = useState<ArchiveCursor[]>([]);

  const accountsQuery = useQuery({
    queryKey: ['tracked-accounts', userId],
    enabled: Boolean(session && userId),
    staleTime: TRACKED_ACCOUNTS_STALE_TIME_MS,
    queryFn: async () => {
      if (!session) {
        throw new Error('Clerk session is not ready');
      }

      const supabase = createUserSupabaseClient(() => session.getToken());
      const { data, error } = await supabase
        .from('tracked_accounts')
        .select(trackedAccountFields)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).flatMap((account): TrackedAccount[] =>
        account.dota_account_id === null
          ? []
          : [{ ...account, dota_account_id: account.dota_account_id }],
      );
    },
  });

  const addAccount = useMutation({
    mutationFn: async (value: string) => {
      if (!session || !userId) {
        throw new Error('Clerk session is not ready');
      }

      const token = await session.getToken();
      if (!token) {
        throw new Error('Failed to retrieve Clerk JWT.');
      }

      const profile = await resolveSteamProfile(token, value);
      const supabase = createUserSupabaseClient(async () => token);
      const { data, error } = await supabase
        .from('tracked_accounts')
        .upsert(
          {
            user_id: userId,
            steam_id64: profile.steamId64,
            persona_name: profile.personaName,
            avatar_url: profile.avatarUrl,
            rank_tier: profile.rankTier,
            profile_refreshed_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,steam_id64' },
        )
        .select(trackedAccountFields)
        .single();

      if (error) {
        throw new Error(error.message);
      }
      if (data.dota_account_id === null) {
        throw new Error('Supabase failed to resolve Dota account ID');
      }

      return { ...data, dota_account_id: data.dota_account_id };
    },
    onSuccess: (account) => {
      setSteamProfile('');
      resetArchiveView();
      setSearchParams({ player: String(account.dota_account_id) });
      void queryClient.invalidateQueries({ queryKey: ['tracked-accounts', userId] });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async (account: TrackedAccount) => {
      if (!session || !userId) {
        throw new Error('Clerk session is not ready');
      }

      const token = await session.getToken();
      if (!token) {
        throw new Error('Failed to retrieve Clerk JWT.');
      }

      const supabase = createUserSupabaseClient(async () => token);
      const { error } = await supabase
        .from('tracked_accounts')
        .delete()
        .eq('id', account.id);

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: (_, account) => {
      if (account.dota_account_id === activeAccountId) {
        resetArchiveView();
      }
      void queryClient.invalidateQueries({ queryKey: ['tracked-accounts', userId] });
    },
  });

  function handleDeleteAccount(account: TrackedAccount) {
    if (
      window.confirm(
        t('removeProfileConfirm', { name: account.persona_name ?? t('unknownPlayerName') })
      )
    ) {
      deleteAccount.mutate(account);
    }
  }

  const accounts = accountsQuery.data ?? [];
  const requestedAccountId = parseMatchId(searchParams.get('player'));
  const isRequestedAccountOwned = requestedAccountId !== null
    && accounts.some((account) => account.dota_account_id === requestedAccountId);
  const isExternalRequestedAccount = requestedAccountId !== null && !isRequestedAccountOwned;
  const activeAccountId = isExternalRequestedAccount ? null : isRequestedAccountOwned
    ? requestedAccountId : accounts[0]?.dota_account_id ?? null;
  const activeAccount =
    accounts.find((account) => account.dota_account_id === activeAccountId) ?? null;

  useEffect(() => {
    const playerParam = searchParams.get('player');
    if (!accountsQuery.isSuccess || !playerParam || isRequestedAccountOwned || requestedAccountId !== null) return;

    const normalizedSearchParams = new URLSearchParams(searchParams);
    normalizedSearchParams.delete('player');
    setSearchParams(normalizedSearchParams, { replace: true });
  }, [accountsQuery.isSuccess, isRequestedAccountOwned, requestedAccountId, searchParams, setSearchParams]);

  const archiveCursor = archiveCursors.at(-1) ?? null;
  const archiveOverviewQuery = useQuery<ArchiveOverview>({
    queryKey: archiveQueryKeys.overview(activeAccount?.id, archiveFilters),
    enabled: Boolean(session && activeAccount),
    staleTime: ARCHIVE_STALE_TIME_MS,
    retry: false,
    placeholderData: (previousData, previousQuery) =>
      keepArchiveDataForSameAccount<ArchiveOverview>(previousData, previousQuery, activeAccount?.id),
    queryFn: async ({ signal }) => {
      if (!session || !activeAccount) {
        throw new Error('Profile not selected');
      }

      const token = await session.getToken();
      if (!token) {
        throw new Error('Failed to retrieve Clerk JWT.');
      }

      const supabase = createUserSupabaseClient(async () => token);
      return fetchArchiveOverview(supabase, activeAccount.id, archiveFilters, signal);
    },
  });

  const archivePageQuery = useQuery<ArchivePage>({
    queryKey: archiveQueryKeys.page(activeAccount?.id, archiveFilters, archiveCursor),
    enabled: Boolean(session && activeAccount),
    staleTime: ARCHIVE_STALE_TIME_MS,
    retry: false,
    placeholderData: (previousData, previousQuery) =>
      keepArchiveDataForSameAccount<ArchivePage>(previousData, previousQuery, activeAccount?.id),
    queryFn: async ({ signal }) => {
      if (!session || !activeAccount) throw new Error('Profile not selected');
      const token = await session.getToken();
      if (!token) throw new Error('Failed to retrieve Clerk JWT.');
      const supabase = createUserSupabaseClient(async () => token);
      return fetchArchivePage(supabase, activeAccount.id, archiveFilters, archiveCursor, signal);
    },
  });

  const heroNamesQuery = useQuery({
    queryKey: ['dota-hero-names'],
    staleTime: 86_400_000,
    gcTime: 86_400_000,
    queryFn: () => fetchHeroNames(),
  });

  const archiveSync = useMutation({
    mutationFn: async (trackedAccountId: string) => {
      if (!session) {
        throw new Error('Clerk session is not ready');
      }

      const token = await session.getToken();
      if (!token) {
        throw new Error('Failed to retrieve Clerk JWT.');
      }

      return syncTrackedAccount(token, trackedAccountId);
    },
    onMutate: () => {
      setArchiveSyncMode('page');
      setArchiveSyncProgress(null);
    },
    onSettled: (_result, _error, trackedAccountId) => {
      void queryClient.invalidateQueries({ queryKey: archiveQueryKeys.root(trackedAccountId) });
    },
  });

  const archiveSyncAll = useMutation({
    mutationFn: async (trackedAccountId: string) => {
      if (!session) {
        throw new Error('Clerk session is not ready');
      }

      const token = await session.getToken();
      if (!token) {
        throw new Error('Failed to retrieve Clerk JWT.');
      }

      return syncAllTrackedAccount(token, trackedAccountId, {
        onProgress: setArchiveSyncProgress,
      });
    },
    onMutate: () => {
      setArchiveSyncMode('all');
      setArchiveSyncProgress(null);
    },
    onSettled: (_result, _error, trackedAccountId) => {
      void queryClient.invalidateQueries({ queryKey: archiveQueryKeys.root(trackedAccountId) });
      void queryClient.invalidateQueries({ queryKey: ['match-detail'] });
    },
  });

  function handleSelectAccount(accountId: number) {
    resetArchiveView();
    setSearchParams({ player: String(accountId) });
    archiveSync.reset();
    archiveSyncAll.reset();
    setArchiveSyncProgress(null);
    setArchiveSyncMode(null);
  }

  function resetArchiveView() {
    void queryClient.cancelQueries({ queryKey: ['match-archive'] });
    setArchiveFilters(DEFAULT_ARCHIVE_FILTERS);
    setArchiveCursors([]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedSteamProfile = steamProfile.trim();
    if (normalizedSteamProfile) {
      addAccount.mutate(normalizedSteamProfile);
    }
  }

  const isArchiveSyncForActiveAccount = archiveSync.variables === activeAccount?.id;
  const isArchiveSyncAllForActiveAccount =
    archiveSyncAll.variables === activeAccount?.id;
  const archiveSyncResult: MatchSyncResult | undefined =
    archiveSyncMode === 'all' && isArchiveSyncAllForActiveAccount
    ? archiveSyncAll.data
    : archiveSyncMode === 'page' && isArchiveSyncForActiveAccount
      ? archiveSync.data
      : undefined;
  const archiveSyncError = archiveSyncMode === 'all' && isArchiveSyncAllForActiveAccount
    ? archiveSyncAll.error
    : archiveSyncMode === 'page' && isArchiveSyncForActiveAccount
      ? archiveSync.error
      : null;

  if (accountsQuery.isSuccess && isExternalRequestedAccount) {
    return <ArchiveShowcase
      key={requestedAccountId}
      dotaAccountId={requestedAccountId}
      fallback={<WorkspaceMessage text={t('publicArchiveUnavailable')} />}
    />;
  }

  return (
    <section className="match-workspace" aria-labelledby="workspace-title">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">WORKSPACE / PLAYER</p>
          <h2 id="workspace-title">{t('playerProfileTitle')}</h2>
        </div>
        <form className="steam-form" onSubmit={handleSubmit}>
          <label htmlFor="steam-id">{t('vanitySteamLabel')}</label>
          <div className="steam-form__controls">
            <input
              id="steam-id"
              inputMode="numeric"
              autoComplete="off"
              placeholder="steamcommunity.com/id/name"
              value={steamProfile}
              onChange={(event) => setSteamProfile(event.target.value)}
              aria-describedby="steam-id-hint"
            />
            <button type="submit" disabled={!steamProfile.trim() || addAccount.isPending}>
              {addAccount.isPending ? t('statusChecking') : t('addProfileBtn')}
            </button>
          </div>
          <span id="steam-id-hint">
            {t('vanitySteamHint')}
          </span>
          {addAccount.isError ? (
            <span className="form-error">{addAccount.error.message}</span>
          ) : null}
        </form>
      </div>

      {accountsQuery.isPending ? (
        <WorkspaceMessage text={t('loadingProfilesMsg')} />
      ) : accountsQuery.isError ? (
        <WorkspaceMessage text={accountsQuery.error.message} tone="error" />
      ) : accounts.length === 0 ? (
        <WorkspaceMessage text={t('addSteamHintMsg')} />
      ) : (
        <>
          <AccountRail
            accounts={accounts}
            activeAccountId={activeAccountId}
            onSelect={handleSelectAccount}
            onDelete={handleDeleteAccount}
            t={t}
          />
          <PlayerDashboard
              account={activeAccount}
              overview={archiveOverviewQuery.data}
              page={archivePageQuery.data}
              filters={archiveFilters}
              heroNames={heroNamesQuery.data ?? {}}
              isLoading={archiveOverviewQuery.isPending || archivePageQuery.isPending}
              error={archiveOverviewQuery.error ?? archivePageQuery.error}
              onRefresh={() => {
                void archiveOverviewQuery.refetch();
                void archivePageQuery.refetch();
              }}
              isRefreshing={archiveOverviewQuery.isFetching || archivePageQuery.isFetching}
              onFiltersChange={(filters) => {
                setArchiveFilters(filters);
                setArchiveCursors([]);
              }}
              onNextPage={(cursor) => setArchiveCursors((current) => [...current, cursor])}
              onPreviousPage={() => setArchiveCursors((current) => current.slice(0, -1))}
              hasPreviousPage={archiveCursors.length > 0}
               syncControls={{
                 onSyncArchive: () => { if (activeAccount) archiveSync.mutate(activeAccount.id); },
                 onSyncAllArchive: () => { if (activeAccount) archiveSyncAll.mutate(activeAccount.id); },
                 archiveSyncResult,
                 archiveSyncError,
                 isArchiveSyncing: archiveSync.isPending,
                 isArchiveSyncingAll: archiveSyncAll.isPending,
                 archiveSyncProgress,
               }}
             />
        </>
      )}
    </section>
  );
}

function AccountRail({
  accounts,
  activeAccountId,
  onSelect,
  onDelete,
  t,
}: {
  accounts: TrackedAccount[];
  activeAccountId: number | null;
  onSelect: (accountId: number) => void;
  onDelete: (account: TrackedAccount) => void;
  t: (key: any, options?: any) => string;
}) {
  return (
    <div className="account-rail" aria-label={t('trackedProfilesAriaLabel')}>
      {accounts.map((account) => (
        <div
          key={account.id}
          className={
            account.dota_account_id === activeAccountId
              ? 'account-chip account-chip--active'
              : 'account-chip'
          }
        >
          <button
            className="account-chip__select-btn"
            type="button"
            onClick={() => onSelect(account.dota_account_id)}
          >
            {account.avatar_url ? (
              <img
                src={account.avatar_url}
                alt=""
                width="34"
                height="34"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="account-chip__fallback" aria-hidden="true" />
            )}
            <span>
              <strong>{account.persona_name ?? t('unknownPlayerName')}</strong>
              <small>ID {account.dota_account_id}</small>
            </span>
          </button>
          <button
            className="account-chip__delete-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(account);
            }}
            title={t('removeProfileTitle')}
            aria-label={t('removeProfileAriaLabel', { name: account.persona_name ?? t('unknownPlayerName') })}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function WorkspaceMessage({
  text,
  tone = 'neutral',
}: {
  text: string;
  tone?: 'neutral' | 'error';
}) {
  return (
    <div className={`workspace-message workspace-message--${tone}`}>
      <span aria-hidden="true">{tone === 'error' ? '!' : '+'}</span>
      <p>{text}</p>
    </div>
  );
}
