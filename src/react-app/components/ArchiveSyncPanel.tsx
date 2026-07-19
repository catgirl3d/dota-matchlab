import type { MatchSyncResult } from '../../shared/match-archive';
import type { ArchiveSyncState } from '../lib/archive';
import type { MatchSyncProgress } from '../lib/dota-api';

type ArchiveSyncPanelProps = {
  accountName: string;
  result?: MatchSyncResult;
  syncState?: ArchiveSyncState | null;
  archivedCount?: number;
  isPending: boolean;
  isSyncingAll: boolean;
  fullSyncProgress: MatchSyncProgress | null;
  error: Error | null;
  onSync: () => void;
  onSyncAll: () => void;
};

export function ArchiveSyncPanel({
  accountName,
  result,
  syncState,
  archivedCount = 0,
  isPending,
  isSyncingAll,
  fullSyncProgress,
  error,
  onSync,
  onSyncAll,
}: ArchiveSyncPanelProps) {
  const isBusy = isPending || isSyncingAll;
  const status = result?.status ?? syncState?.status;
  const statusLabel =
    status === 'ready'
      ? 'READY'
      : status === 'partial'
        ? 'PARTIAL'
        : status === 'failed' || status === 'blocked'
          ? 'FAILED'
          : status === 'syncing'
            ? 'SYNCING'
            : 'PENDING';
  const statusClass =
    status === 'ready'
      ? 'is-ready'
      : status === 'failed' || status === 'blocked'
        ? 'is-error'
        : 'is-partial';

  return (
    <section className="archive-sync" aria-labelledby="archive-sync-title">
      <div className="archive-sync__topline">
        <span className="micro-label">ARCHIVE / STRATZ SYNC</span>
        {status ? (
          <span className={`archive-sync__status ${statusClass}`}>
            <span aria-hidden="true" />
            {statusLabel}
          </span>
        ) : null}
      </div>
        <h3 id="archive-sync-title">Собрать историю матчей</h3>
      <p>
        История загружается пакетами до 500 матчей <strong>{accountName}</strong>.
        Detail загружается вручную из выбранного матча.
      </p>
      <div className="archive-sync__actions">
        <button
          className="archive-sync__button"
          type="button"
          onClick={onSyncAll}
          disabled={isBusy}
        >
          <span>{isSyncingAll ? 'Парсим всю историю…' : 'Запарсить все'}</span>
          <span aria-hidden="true">↗</span>
        </button>
        <button
          className="archive-sync__button archive-sync__button--secondary"
          type="button"
          onClick={onSync}
          disabled={isBusy}
        >
          <span>{isPending ? 'Синхронизируем…' : 'Загрузить один пакет'}</span>
          <span aria-hidden="true">+500</span>
        </button>
      </div>
      {isSyncingAll && fullSyncProgress ? (
        <p className="archive-sync__progress" aria-live="polite">
          Пакетов: <strong>{fullSyncProgress.completedBatches}</strong>
          {' · '}получено: <strong>{fullSyncProgress.fetchedMatches}</strong>
          {' · '}offset: <strong>{fullSyncProgress.nextOffset}</strong>
        </p>
      ) : null}
      {result || syncState ? (
        <p className="archive-sync__result" aria-live="polite">
          В архиве: <strong>{archivedCount || result?.archivedMatches || 0}</strong>
          {syncState?.history_provider ? ` · ${syncState.history_provider.toUpperCase()}` : ''}
          {status === 'ready'
            ? ' · достигнут конец доступной истории'
            : status === 'partial'
              ? ' · есть следующая страница'
              : ' · синхронизация ещё не запускалась'}
          {syncState?.last_success_at ? ` · обновлён ${formatSyncDate(syncState.last_success_at)}` : ''}
        </p>
      ) : null}
      {error ? (
        <p className="archive-sync__error" role="alert">
          {error.message}
        </p>
      ) : null}
    </section>
  );
}

function formatSyncDate(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
