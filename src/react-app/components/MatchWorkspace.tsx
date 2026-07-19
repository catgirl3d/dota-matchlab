import { useAuth, useSession } from '@clerk/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { Tables } from '../../shared/database.types';
import type { MatchSyncResult } from '../../shared/match-archive';
import { fetchArchiveOverview, fetchArchivePage, type ArchiveCursor } from '../lib/archive';
import { DEFAULT_ARCHIVE_FILTERS, type ArchiveFilters } from '../lib/archive-analytics';
import { archiveQueryKeys } from '../lib/archive-query-keys';
import { fetchMatchDetail } from '../lib/match-detail';
import {
  fetchHeroNames,
  resolveSteamProfile,
  syncAllTrackedAccount,
  syncTrackedMatchDetail,
  syncTrackedAccount,
  type MatchSyncProgress,
} from '../lib/dota-api';
import { createUserSupabaseClient } from '../lib/supabase';
import { MatchDetailView } from './MatchDetailView';
import { PlayerDashboard } from './PlayerDashboard';

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

export function MatchWorkspace() {
  const { session } = useSession();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [steamProfile, setSteamProfile] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [archiveSyncProgress, setArchiveSyncProgress] =
    useState<MatchSyncProgress | null>(null);
  const [archiveSyncMode, setArchiveSyncMode] = useState<'page' | 'all' | null>(null);
  const [archiveFilters, setArchiveFilters] = useState<ArchiveFilters>(DEFAULT_ARCHIVE_FILTERS);
  const [archiveCursors, setArchiveCursors] = useState<ArchiveCursor[]>([]);

  const accountsQuery = useQuery({
    queryKey: ['tracked-accounts', userId],
    enabled: Boolean(session && userId),
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
        throw new Error('Не удалось получить Clerk JWT');
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
        throw new Error('Supabase не рассчитала Dota account ID');
      }

      return { ...data, dota_account_id: data.dota_account_id };
    },
    onSuccess: (account) => {
      setSteamProfile('');
      resetArchiveView();
      setSelectedAccountId(account.dota_account_id);
      void queryClient.invalidateQueries({ queryKey: ['tracked-accounts', userId] });
    },
  });

  const accounts = accountsQuery.data ?? [];
  const activeAccountId = selectedAccountId ?? accounts[0]?.dota_account_id ?? null;
  const activeAccount =
    accounts.find((account) => account.dota_account_id === activeAccountId) ?? null;

  const archiveCursor = archiveCursors.at(-1) ?? null;
  const archiveOverviewQuery = useQuery({
    queryKey: archiveQueryKeys.overview(activeAccount?.id, archiveFilters),
    enabled: Boolean(session && activeAccount),
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!session || !activeAccount) {
        throw new Error('Профиль не выбран');
      }

      const token = await session.getToken();
      if (!token) {
        throw new Error('Не удалось получить Clerk JWT');
      }

      const supabase = createUserSupabaseClient(async () => token);
      return fetchArchiveOverview(supabase, activeAccount.id, archiveFilters, signal);
    },
  });

  const archivePageQuery = useQuery({
    queryKey: archiveQueryKeys.page(activeAccount?.id, archiveFilters, archiveCursor),
    enabled: Boolean(session && activeAccount),
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!session || !activeAccount) throw new Error('Профиль не выбран');
      const token = await session.getToken();
      if (!token) throw new Error('Не удалось получить Clerk JWT');
      const supabase = createUserSupabaseClient(async () => token);
      return fetchArchivePage(supabase, activeAccount.id, archiveFilters, archiveCursor, signal);
    },
  });

  const heroNamesQuery = useQuery({
    queryKey: ['dota-hero-names'],
    enabled: Boolean(session && activeAccount),
    staleTime: 86_400_000,
    gcTime: 86_400_000,
    queryFn: async () => {
      if (!session) {
        throw new Error('Clerk session is not ready');
      }
      const token = await session.getToken();
      if (!token) {
        throw new Error('Не удалось получить Clerk JWT');
      }
      return fetchHeroNames(token);
    },
  });

  const matchDetailQuery = useQuery({
    queryKey: ['match-detail', selectedMatchId],
    enabled: Boolean(session && selectedMatchId),
    staleTime: 300_000,
    queryFn: async () => {
      if (!session || selectedMatchId === null) {
        throw new Error('Матч не выбран');
      }
      const token = await session.getToken();
      if (!token) {
        throw new Error('Не удалось получить Clerk JWT');
      }
      const supabase = createUserSupabaseClient(async () => token);
      return fetchMatchDetail(supabase, selectedMatchId);
    },
  });

  const archiveSync = useMutation({
    mutationFn: async (trackedAccountId: string) => {
      if (!session) {
        throw new Error('Clerk session is not ready');
      }

      const token = await session.getToken();
      if (!token) {
        throw new Error('Не удалось получить Clerk JWT');
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
        throw new Error('Не удалось получить Clerk JWT');
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

  const matchDetailSync = useMutation({
    mutationFn: async ({
      trackedAccountId,
      matchId,
    }: {
      trackedAccountId: string;
      matchId: number;
    }) => {
      if (!session) {
        throw new Error('Clerk session is not ready');
      }
      const token = await session.getToken();
      if (!token) {
        throw new Error('Не удалось получить Clerk JWT');
      }
      return syncTrackedMatchDetail(token, trackedAccountId, matchId);
    },
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ['match-detail', variables.matchId],
      });
      void queryClient.invalidateQueries({ queryKey: archiveQueryKeys.root(variables.trackedAccountId) });
    },
  });

  function handleSelectAccount(accountId: number) {
    resetArchiveView();
    setSelectedAccountId(accountId);
    archiveSync.reset();
    archiveSyncAll.reset();
    matchDetailSync.reset();
    setArchiveSyncProgress(null);
    setArchiveSyncMode(null);
  }

  function resetArchiveView() {
    void queryClient.cancelQueries({ queryKey: ['match-archive'] });
    setSelectedMatchId(null);
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

  return (
    <section className="match-workspace" aria-labelledby="workspace-title">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">WORKSPACE / PLAYER</p>
          <h2 id="workspace-title">Профиль игрока</h2>
        </div>
        <form className="steam-form" onSubmit={handleSubmit}>
          <label htmlFor="steam-id">Steam-профиль</label>
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
              {addAccount.isPending ? 'Проверяем…' : 'Добавить профиль'}
            </button>
          </div>
          <span id="steam-id-hint">
            Ссылка Steam, vanity name или SteamID64; владение не подтверждается.
          </span>
          {addAccount.isError ? (
            <span className="form-error">{addAccount.error.message}</span>
          ) : null}
        </form>
      </div>

      {accountsQuery.isPending ? (
        <WorkspaceMessage text="Загружаем профили…" />
      ) : accountsQuery.isError ? (
        <WorkspaceMessage text={accountsQuery.error.message} tone="error" />
      ) : accounts.length === 0 ? (
        <WorkspaceMessage text="Добавьте ссылку Steam-профиля, чтобы собрать личный архив." />
      ) : (
        <>
          <AccountRail
            accounts={accounts}
            activeAccountId={activeAccountId}
            onSelect={handleSelectAccount}
          />
          {selectedMatchId !== null && activeAccount ? (
            <MatchDetailView
              detail={matchDetailQuery.data}
              heroNames={heroNamesQuery.data ?? {}}
              currentAccountId={activeAccount.dota_account_id}
              isLoading={matchDetailQuery.isPending}
              error={matchDetailQuery.error}
              parseError={
                matchDetailSync.variables?.matchId === selectedMatchId
                  ? matchDetailSync.error
                  : null
              }
              isParsing={
                matchDetailSync.isPending &&
                matchDetailSync.variables?.matchId === selectedMatchId
              }
              onBack={() => setSelectedMatchId(null)}
              onRefresh={() => matchDetailQuery.refetch()}
              onParse={() => {
                matchDetailSync.mutate({
                  trackedAccountId: activeAccount.id,
                  matchId: selectedMatchId,
                });
              }}
            />
          ) : (
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
              onSelectMatch={setSelectedMatchId}
              isRefreshing={archiveOverviewQuery.isFetching || archivePageQuery.isFetching}
              onFiltersChange={(filters) => {
                setArchiveFilters(filters);
                setArchiveCursors([]);
              }}
              onNextPage={(cursor) => setArchiveCursors((current) => [...current, cursor])}
              onPreviousPage={() => setArchiveCursors((current) => current.slice(0, -1))}
              hasPreviousPage={archiveCursors.length > 0}
              onSyncArchive={() => {
                if (activeAccount) {
                  archiveSync.mutate(activeAccount.id);
                }
              }}
              onSyncAllArchive={() => {
                if (activeAccount) {
                  archiveSyncAll.mutate(activeAccount.id);
                }
              }}
              archiveSyncResult={archiveSyncResult}
              archiveSyncError={archiveSyncError}
              isArchiveSyncing={archiveSync.isPending}
              isArchiveSyncingAll={archiveSyncAll.isPending}
              archiveSyncProgress={archiveSyncProgress}
            />
          )}
        </>
      )}
    </section>
  );
}

function AccountRail({
  accounts,
  activeAccountId,
  onSelect,
}: {
  accounts: TrackedAccount[];
  activeAccountId: number | null;
  onSelect: (accountId: number) => void;
}) {
  return (
    <div className="account-rail" aria-label="Отслеживаемые профили">
      {accounts.map((account) => (
        <button
          key={account.id}
          className={
            account.dota_account_id === activeAccountId
              ? 'account-chip account-chip--active'
              : 'account-chip'
          }
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
            <strong>{account.persona_name ?? 'Неизвестный игрок'}</strong>
            <small>ID {account.dota_account_id}</small>
          </span>
        </button>
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
