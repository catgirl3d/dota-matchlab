import { useAuth, useSession } from '@clerk/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { RecentDotaMatch } from '../../shared/dota';
import type { MatchSyncResult } from '../../shared/match-archive';
import {
  fetchRecentMatches,
  resolveSteamProfile,
  syncTrackedAccount,
} from '../lib/dota-api';
import { ArchiveSyncPanel } from './ArchiveSyncPanel';
import type { Tables } from '../../shared/database.types';
import { calculateMatchSummary } from '../lib/match-summary';
import { createUserSupabaseClient } from '../lib/supabase';

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

      return {
        account: { ...data, dota_account_id: data.dota_account_id },
        profile,
      };
    },
    onSuccess: ({ account }) => {
      setSteamProfile('');
      setSelectedAccountId(account.dota_account_id);
      void queryClient.invalidateQueries({ queryKey: ['tracked-accounts', userId] });
    },
  });

  const accounts = accountsQuery.data ?? [];
  const activeAccountId =
    selectedAccountId ?? accounts[0]?.dota_account_id ?? null;
  const activeAccount =
    accounts.find((account) => account.dota_account_id === activeAccountId) ??
    null;

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
  });

  function handleSelectAccount(accountId: number) {
    setSelectedAccountId(accountId);
    archiveSync.reset();
  }

  const isArchiveSyncForActiveAccount =
    archiveSync.variables === activeAccount?.id;
  const archiveSyncResult: MatchSyncResult | undefined =
    isArchiveSyncForActiveAccount ? archiveSync.data : undefined;
  const archiveSyncError = isArchiveSyncForActiveAccount ? archiveSync.error : null;

  const matchesQuery = useQuery({
    queryKey: ['recent-matches', activeAccountId],
    enabled: Boolean(session && activeAccountId !== null),
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      if (!session || activeAccountId === null) {
        throw new Error('Профиль не выбран');
      }

      const token = await session.getToken();
      if (!token) {
        throw new Error('Не удалось получить Clerk JWT');
      }

      return fetchRecentMatches(token, activeAccountId);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedSteamProfile = steamProfile.trim();
    if (normalizedSteamProfile) {
      addAccount.mutate(normalizedSteamProfile);
    }
  }

  return (
    <section className="match-workspace" aria-labelledby="workspace-title">
      <div className="workspace-header">
        <div>
          <p className="eyebrow">WORKSPACE / 02</p>
          <h2 id="workspace-title">Последние матчи</h2>
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
            <button
              type="submit"
              disabled={!steamProfile.trim() || addAccount.isPending}
            >
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
        <WorkspaceMessage text="Добавьте ссылку Steam-профиля, чтобы получить первые матчи." />
      ) : (
        <>
          <AccountRail
            accounts={accounts}
            activeAccountId={activeAccountId}
            onSelect={handleSelectAccount}
          />
          <MatchAnalysis
            account={activeAccount}
            matches={matchesQuery.data?.matches}
            isLoading={matchesQuery.isPending}
            error={matchesQuery.error}
            onRefresh={() => matchesQuery.refetch()}
            isRefreshing={matchesQuery.isFetching}
            onSyncArchive={() => {
              if (activeAccount) {
                archiveSync.mutate(activeAccount.id);
              }
            }}
            archiveSyncResult={archiveSyncResult}
            archiveSyncError={archiveSyncError}
            isArchiveSyncing={archiveSync.isPending}
          />
        </>
      )}
    </section>
  );
}

type AccountRailProps = {
  accounts: TrackedAccount[];
  activeAccountId: number | null;
  onSelect: (accountId: number) => void;
};

function AccountRail({ accounts, activeAccountId, onSelect }: AccountRailProps) {
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

type MatchAnalysisProps = {
  account: TrackedAccount | null;
  matches?: RecentDotaMatch[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  onRefresh: () => void;
  onSyncArchive: () => void;
  archiveSyncResult?: MatchSyncResult;
  archiveSyncError: Error | null;
  isArchiveSyncing: boolean;
};

function MatchAnalysis({
  account,
  matches,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  onSyncArchive,
  archiveSyncResult,
  archiveSyncError,
  isArchiveSyncing,
}: MatchAnalysisProps) {
  if (isLoading) {
    return <WorkspaceMessage text="OpenDota собирает последние матчи…" />;
  }
  if (error) {
    return <WorkspaceMessage text={error.message} tone="error" />;
  }
  if (!matches || matches.length === 0) {
    return (
      <WorkspaceMessage text="Матчи не найдены. Проверьте настройку Expose Public Match Data в Dota 2." />
    );
  }

  const summary = calculateMatchSummary(matches);

  return (
    <div className="analysis-grid">
      <aside className="summary-panel">
        <div className="summary-panel__heading">
          <div>
            <span className="micro-label">ACTIVE PLAYER</span>
            <h3>{account?.persona_name ?? 'Dota player'}</h3>
          </div>
          <button type="button" onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing ? '…' : '↻'}
            <span className="sr-only">Обновить матчи</span>
          </button>
        </div>

        <div className="win-rate">
          <strong>{summary.winRate}%</strong>
          <span>побед за {summary.matches} матчей</span>
        </div>

        <dl className="summary-stats">
          <div>
            <dt>W / L</dt>
            <dd>
              {summary.wins} / {summary.losses}
            </dd>
          </div>
          <div>
            <dt>K / D / A</dt>
            <dd>
              {summary.averageKills} / {summary.averageDeaths} /{' '}
              {summary.averageAssists}
            </dd>
          </div>
          <div>
            <dt>AVG GPM</dt>
            <dd>{summary.averageGpm}</dd>
          </div>
          </dl>
          <ArchiveSyncPanel
            accountName={account?.persona_name ?? 'Dota player'}
            result={archiveSyncResult}
            isPending={isArchiveSyncing}
            error={archiveSyncError}
            onSync={onSyncArchive}
          />
        </aside>

      <div className="match-list" role="list" aria-label="Последние матчи">
        {matches.map((match) => (
          <article
            key={match.matchId}
            className={match.won ? 'match-row match-row--won' : 'match-row'}
            role="listitem"
          >
            <span className="match-row__result">
              {match.won ? 'WIN' : 'LOSS'}
            </span>
            <div className="match-row__hero">
              <strong>{match.heroName}</strong>
              <span>{formatMatchDate(match.startTime)}</span>
            </div>
            <div className="match-row__kda">
              <strong>
                {match.kills} / {match.deaths} / {match.assists}
              </strong>
              <span>K / D / A</span>
            </div>
            <div className="match-row__metric">
              <strong>{match.goldPerMinute}</strong>
              <span>GPM</span>
            </div>
            <div className="match-row__metric">
              <strong>{formatDuration(match.durationSeconds)}</strong>
              <span>DURATION</span>
            </div>
          </article>
        ))}
      </div>
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

function formatMatchDate(timestamp: number): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1_000));
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
