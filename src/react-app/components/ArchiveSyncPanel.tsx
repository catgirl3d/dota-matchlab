import type { MatchSyncResult } from '../../shared/match-archive';

type ArchiveSyncPanelProps = {
  accountName: string;
  result?: MatchSyncResult;
  isPending: boolean;
  error: Error | null;
  onSync: () => void;
};

export function ArchiveSyncPanel({
  accountName,
  result,
  isPending,
  error,
  onSync,
}: ArchiveSyncPanelProps) {
  const statusLabel = result?.status === 'ready' ? 'READY' : 'PARTIAL';
  const statusClass = result?.status === 'ready' ? 'is-ready' : 'is-partial';

  return (
    <section className="archive-sync" aria-labelledby="archive-sync-title">
      <div className="archive-sync__topline">
        <span className="micro-label">ARCHIVE / PAGE SYNC</span>
        {result ? (
          <span className={`archive-sync__status ${statusClass}`}>
            <span aria-hidden="true" />
            {statusLabel}
          </span>
        ) : null}
      </div>
      <h3 id="archive-sync-title">Собрать историю</h3>
      <p>
        Одна страница для <strong>{accountName}</strong>. Повторяйте запуск, пока
        архив не дойдёт до конца публичной истории.
      </p>
      <button
        className="archive-sync__button"
        type="button"
        onClick={onSync}
        disabled={isPending}
      >
        <span>{isPending ? 'Синхронизируем…' : 'Синхронизировать страницу'}</span>
        <span aria-hidden="true">↗</span>
      </button>
      {result ? (
        <p className="archive-sync__result" aria-live="polite">
          Сохранено матчей: <strong>{result.archivedMatches}</strong>
          {result.status === 'ready'
            ? ' · достигнут конец доступной истории'
            : ' · есть следующая страница'}
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
