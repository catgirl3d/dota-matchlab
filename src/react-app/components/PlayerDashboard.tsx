import { type CSSProperties } from 'react';
import { Link } from 'react-router';
import type { MatchSyncResult } from '../../shared/match-archive';
import type { Tables } from '../../shared/database.types';
import type { ArchiveCursor, ArchiveOverview, ArchivePage } from '../lib/archive';
import { HeroMark } from './HeroMark';
import type { MatchSyncProgress } from '../lib/dota-api';
import {
  getModeLabelForFilter,
  getPositionLabelForFilter,
  type ArchiveFilters,
} from '../lib/archive-analytics';
import { ArchiveSyncPanel } from './ArchiveSyncPanel';
import { FilterDropdown } from './FilterDropdown';

type PlayerAccount = Pick<
  Tables<'tracked_accounts'>,
  'id' | 'avatar_url' | 'persona_name' | 'rank_tier'
> & { dota_account_id: number };

type PlayerDashboardProps = {
  account: PlayerAccount | null;
  overview?: ArchiveOverview;
  page?: ArchivePage;
  filters: ArchiveFilters;
  heroNames: Record<number, string>;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  onRefresh: () => void;
  onFiltersChange: (filters: ArchiveFilters) => void;
  onNextPage: (cursor: ArchiveCursor) => void;
  onPreviousPage: () => void;
  hasPreviousPage: boolean;
  onSyncArchive: () => void;
  onSyncAllArchive: () => void;
  archiveSyncResult?: MatchSyncResult;
  archiveSyncError: Error | null;
  isArchiveSyncing: boolean;
  isArchiveSyncingAll: boolean;
  archiveSyncProgress: MatchSyncProgress | null;
};

export function PlayerDashboard({
  account,
  overview,
  page,
  filters,
  heroNames,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  onFiltersChange,
  onNextPage,
  onPreviousPage,
  hasPreviousPage,
  onSyncArchive,
  onSyncAllArchive,
  archiveSyncResult,
  archiveSyncError,
  isArchiveSyncing,
  isArchiveSyncingAll,
  archiveSyncProgress,
}: PlayerDashboardProps) {
  const analytics = overview?.summary;
  const matches = page?.matches ?? [];

  if (isLoading && !overview) {
    return <WorkspaceMessage text="Читаем личный архив из Supabase…" />;
  }
  if (error) {
    return <WorkspaceMessage text={error.message} tone="error" />;
  }
  if (!account) {
    return <WorkspaceMessage text="Профиль игрока не выбран." />;
  }
  if (!overview || !analytics) {
    return <WorkspaceMessage text="Архив пока не содержит доступного обзора." />;
  }

  return (
    <section className="player-dashboard" aria-labelledby="player-dashboard-title">
      <header className="player-identity">
        <div className="player-identity__avatar-wrap">
          {account.avatar_url ? (
            <img
              className="player-identity__avatar"
              src={account.avatar_url}
              alt=""
              width="112"
              height="112"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="player-identity__avatar player-identity__avatar--empty" />
          )}
          <span className="player-identity__signal" aria-hidden="true" />
        </div>
        <div className="player-identity__copy">
          <p className="eyebrow">PLAYER DOSSIER / ARCHIVE</p>
          <h2 id="player-dashboard-title">
            {account.persona_name ?? 'Unknown player'}
            <span className="player-identity__tag">#{account.dota_account_id}</span>
          </h2>
          <div className="player-identity__meta">
            <span>{formatRank(account.rank_tier)}</span>
            <span>Personal match archive</span>
            <span>{overview.integrity.linked.toLocaleString('ru-RU')} indexed</span>
            <span>{overview.integrity.complete} complete · {overview.integrity.missingStats} missing stats · {overview.integrity.missingMatch} missing match</span>
          </div>
        </div>
        <div className="player-identity__actions">
          <button
            className="icon-button"
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Обновить архив"
          >
            {isRefreshing ? '…' : '↻'}
          </button>
          <span className="player-identity__stamp">M/L · 2026</span>
        </div>
      </header>

      <div className="archive-control-bar">
        <div className="filter-heading">
          <span className="micro-label">FILTER THE SIGNAL</span>
          <strong>{analytics.matches.toLocaleString('ru-RU')} matches in view</strong>
        </div>
        <FilterDropdown
          label="Period"
          value={filters.period}
          onChange={(value) => onFiltersChange({ ...filters, period: value as ArchiveFilters['period'] })}
          options={[
            ['all', 'All time'],
            ['30d', 'Last 30 days'],
            ['90d', 'Last 90 days'],
            ['year', 'Last year'],
          ]}
        />
        <FilterDropdown
          label="Mode"
          value={filters.mode}
          onChange={(value) => onFiltersChange({ ...filters, mode: value as ArchiveFilters['mode'] })}
          options={(['all', 'ranked', 'turbo', 'all-pick'] as const).map((value) => [
            value,
            getModeLabelForFilter(value),
          ])}
        />
        <FilterDropdown
          label="Position"
          value={filters.position}
          onChange={(value) => onFiltersChange({ ...filters, position: value as ArchiveFilters['position'] })}
          options={(['all', 'carry', 'mid', 'offlane', 'support', 'hard-support'] as const).map(
            (value) => [value, getPositionLabelForFilter(value)],
          )}
        />
        <FilterDropdown
          label="Result"
          value={filters.result}
          onChange={(value) => onFiltersChange({ ...filters, result: value as ArchiveFilters['result'] })}
          options={[
            ['all', 'All results'],
            ['wins', 'Wins only'],
            ['losses', 'Losses only'],
          ]}
        />
        <FilterDropdown
          label="Queue"
          value={filters.party}
          onChange={(value) => onFiltersChange({ ...filters, party: value as ArchiveFilters['party'] })}
          options={[
            ['all', 'Solo / Party'],
            ['solo', 'Solo only'],
            ['party', 'Party only'],
          ]}
        />
        <HeroFilter
          value={filters.heroId}
          heroNames={heroNames}
          heroIds={overview.heroOptions}
          onChange={(heroId) => onFiltersChange({ ...filters, heroId })}
        />
      </div>

      <div className="dashboard-metrics">
        <MetricCard
          label="Indexed matches"
          value={formatNumber(analytics.matches)}
          detail={`${formatDate(analytics.firstMatchAt)} → ${formatDate(analytics.latestMatchAt)}`}
          tone="acid"
        />
        <MetricCard
          label="Win rate"
          value={`${analytics.winRate}%`}
          detail={`${analytics.wins} W · ${analytics.losses} L`}
          tone="red"
          progress={analytics.winRate}
        />
        <MetricCard
          label="Average KDA"
          value={analytics.averageKda.toFixed(1)}
          detail={`${analytics.averageKills} / ${analytics.averageDeaths} / ${analytics.averageAssists}`}
          tone="violet"
        />
        <MetricCard
          label="Tempo / economy"
          value={`${analytics.averageGpm} GPM`}
          detail={`${analytics.averageXpm} XPM · ${analytics.averageLastHits} LH`}
          tone="blue"
        />
      </div>

      <div className="dashboard-columns">
        <div className="dashboard-main-column">
          <section className="dashboard-card form-card" aria-labelledby="form-title">
            <div className="card-heading">
              <div>
                <span className="micro-label">RECENT FORM / LAST 20</span>
                <h3 id="form-title">The signal is still moving</h3>
              </div>
              <span className="card-heading__count">{analytics.matches} / {overview.integrity.complete}</span>
            </div>
            <FormStrip form={overview.form} />
            <div className="form-card__footer">
              <span>{analytics.wins} wins in current view</span>
              <span>{analytics.averageDurationMinutes} min average match</span>
            </div>
          </section>

          <section className="dashboard-card matches-card" aria-labelledby="matches-title">
            <div className="card-heading">
              <div>
                <span className="micro-label">ARCHIVE / MATCH LOG</span>
                <h3 id="matches-title">Matches</h3>
              </div>
              <span className="card-heading__count">{overview.integrity.complete.toLocaleString('ru-RU')} complete</span>
            </div>
            {isLoading && !page ? (
              <div className="empty-state">Загружаем страницу матчей…</div>
            ) : matches.length === 0 ? (
              <div className="empty-state">Нет матчей под выбранные фильтры.</div>
            ) : (
              <ul className="archive-match-table" aria-label="Архив матчей">
                {matches.map((match) => (
                  <ArchiveMatchRow
                    key={match.matchId}
                    match={match}
                    heroNames={heroNames}
                    playerId={account.dota_account_id}
                  />
                ))}
              </ul>
            )}
            <div className="table-note">
              <button type="button" onClick={onPreviousPage} disabled={!hasPreviousPage || isRefreshing}>Previous</button>
              <button type="button" onClick={() => page?.nextCursor && onNextPage(page.nextCursor)} disabled={!page?.nextCursor || isRefreshing}>Next</button>
            </div>
          </section>
        </div>

        <aside className="dashboard-side-column">
          <section className="dashboard-card radar-card" aria-labelledby="breakdown-title">
            <div className="card-heading">
              <div>
                <span className="micro-label">BREAKDOWN / MODES</span>
                <h3 id="breakdown-title">Where the wins come from</h3>
              </div>
            </div>
            <BreakdownList items={overview.modes} />
            <div className="side-divider" />
            <span className="micro-label">QUEUE / TEMPO</span>
            <BreakdownList items={overview.party} compact />
            <BreakdownList items={overview.tempo} compact />
          </section>

          <section className="dashboard-card hero-pool-card" aria-labelledby="hero-pool-title">
            <div className="card-heading">
              <div>
                <span className="micro-label">HERO POOL / REPEAT SIGNAL</span>
                <h3 id="hero-pool-title">Most played</h3>
              </div>
              {filters.heroId !== null ? (
                <button
                  className="hero-pool__reset"
                  type="button"
                  aria-label="Сбросить фильтр героя"
                  title="Сбросить фильтр героя"
                  onClick={() => onFiltersChange({ ...filters, heroId: null })}
                >
                  <span aria-hidden="true">×</span>
                </button>
              ) : null}
            </div>
            <HeroPool
              heroes={overview.heroes.slice(0, 6).map((hero) => ({ ...hero, label: heroNames[hero.heroId] ?? `Hero #${hero.heroId}` }))}
              selectedHeroId={filters.heroId}
              onSelectHero={(heroId) => onFiltersChange({ ...filters, heroId })}
            />
          </section>

          <section className="dashboard-card lane-card" aria-labelledby="lane-title">
            <div className="card-heading">
              <div>
                <span className="micro-label">POSITION / LANE</span>
                <h3 id="lane-title">Role record</h3>
              </div>
            </div>
            <BreakdownList items={overview.positions} />
            <BreakdownList items={overview.lanes} compact />
          </section>

          <ArchiveSyncPanel
            accountName={account.persona_name ?? 'Dota player'}
            result={archiveSyncResult}
            syncState={overview.syncState}
            archivedCount={overview.integrity.linked}
            isPending={isArchiveSyncing}
            isSyncingAll={isArchiveSyncingAll}
            fullSyncProgress={archiveSyncProgress}
            error={archiveSyncError}
            onSync={onSyncArchive}
            onSyncAll={onSyncAllArchive}
          />
        </aside>
      </div>
    </section>
  );
}

function HeroFilter({
  value,
  heroNames,
  heroIds,
  onChange,
}: {
  value: number | null;
  heroNames: Record<number, string>;
  heroIds: number[];
  onChange: (heroId: number | null) => void;
}) {
  const sortedHeroIds = [...heroIds].sort(
    (left, right) => (heroNames[left] ?? '').localeCompare(heroNames[right] ?? ''),
  );

  return (
    <FilterDropdown
      label="Hero"
      value={value === null ? 'all' : String(value)}
      searchable
      onChange={(optionValue) => onChange(optionValue === 'all' ? null : Number(optionValue))}
      options={[
        ['all', 'All heroes'],
        ...sortedHeroIds.map((heroId) => [String(heroId), heroNames[heroId] ?? `Hero #${heroId}`] as const),
      ]}
    />
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
  progress,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'acid' | 'red' | 'violet' | 'blue';
  progress?: number;
}) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span className="micro-label">{label}</span>
      <strong>{value}</strong>
      {progress !== undefined ? (
        <span
          className="metric-card__progress"
          style={{ '--progress': `${progress}%` } as CSSProperties}
        />
      ) : null}
      <span className="metric-card__detail">{detail}</span>
    </article>
  );
}

function FormStrip({ form }: { form: Array<'win' | 'loss' | 'unknown'> }) {
  return (
    <div className="form-strip" aria-label="Результаты последних матчей">
      {form.length === 0 ? (
        <span className="form-strip__empty">No data yet</span>
      ) : (
        form.map((result, index) => (
          <span
            key={`${result}-${index}`}
            className={`form-strip__cell form-strip__cell--${result}`}
            title={result === 'win' ? 'Победа' : result === 'loss' ? 'Поражение' : 'Неизвестно'}
          />
        ))
      )}
    </div>
  );
}

function BreakdownList({
  items,
  compact = false,
}: {
  items: Array<{ key: string; label: string; matches: number; winRate: number }>;
  compact?: boolean;
}) {
  return (
    <div className={`breakdown-list${compact ? ' breakdown-list--compact' : ''}`}>
      {items.length === 0 ? <span className="breakdown-list__empty">No signal</span> : null}
      {items.map((item) => (
        <div className="breakdown-row" key={item.key}>
          <span className="breakdown-row__label">{item.label}</span>
          <span className="breakdown-row__bar">
            <span style={{ width: `${item.winRate}%` }} />
          </span>
          <strong>{item.winRate}%</strong>
          <small>{item.matches}</small>
        </div>
      ))}
    </div>
  );
}

function HeroPool({
  heroes,
  selectedHeroId,
  onSelectHero,
}: {
  heroes: Array<{
    heroId: number;
    label: string;
    matches: number;
    winRate: number;
    averageKda: number;
  }>;
  selectedHeroId: number | null;
  onSelectHero: (heroId: number) => void;
}) {
  const maxMatches = heroes[0]?.matches ?? 1;
  return (
    <div className="hero-pool">
      {heroes.length === 0 ? <span className="breakdown-list__empty">No hero data</span> : null}
      {heroes.map((hero) => (
        <button
          className={`hero-pool__row${hero.heroId === selectedHeroId ? ' is-selected' : ''}`}
          type="button"
          key={hero.heroId}
          aria-pressed={hero.heroId === selectedHeroId}
          aria-label={`Filter by ${hero.label}`}
          onClick={() => onSelectHero(hero.heroId)}
        >
          <HeroMark
            heroId={hero.heroId}
            label={hero.label}
            fallback={hero.label.slice(0, 2).toUpperCase()}
            className="hero-pool__portrait"
          />
          <div className="hero-pool__copy">
            <strong>{hero.label}</strong>
            <span>{hero.matches} games · {hero.averageKda.toFixed(1)} KDA</span>
          </div>
          <strong className="hero-pool__rate">{hero.winRate}%</strong>
          <span
            className="hero-pool__bar"
            style={{ '--hero-share': `${(hero.matches / maxMatches) * 100}%` } as CSSProperties}
          />
        </button>
      ))}
    </div>
  );
}

function ArchiveMatchRow({
  match,
  heroNames,
  playerId,
}: {
  match: ArchivePage['matches'][number];
  heroNames: Record<number, string>;
  playerId: number;
}) {
  const isMissingStats = match.dataStatus === 'missing_player_stats';
  const result = isMissingStats ? 'DATA' : match.won === true ? 'WIN' : match.won === false ? 'LOSS' : '—';
  const resultClass = isMissingStats ? 'is-unknown' : match.won === true ? 'is-win' : match.won === false ? 'is-loss' : 'is-unknown';
  const heroLabel = match.heroId === null ? 'Unknown hero' : heroNames[match.heroId] ?? `Hero #${match.heroId}`;
  const heroFallback = match.heroId === null ? '?' : heroLabel.slice(0, 2).toUpperCase();
  return (
    <li className="archive-match-row">
      <Link
        className={`archive-match-row__link ${resultClass}`}
        to={`/matches/${match.matchId}?player=${playerId}`}
        aria-label={`Открыть матч ${match.matchId}`}
      >
        <span className="archive-match-row__result">{result}</span>
        <HeroMark heroId={match.heroId} label={heroLabel} fallback={heroFallback} className="archive-match-row__hero-mark" />
        <div className="archive-match-row__identity">
          <strong>{heroLabel}</strong>
          <span>
            {formatMatchDate(match.startTime)} · {formatMode(match.gameMode)}
            {isMissingStats ? ' · Missing player stats' : ''}
          </span>
        </div>
        <strong className="archive-match-row__kda">
          {formatStat(match.kills)} / {formatStat(match.deaths)} / {formatStat(match.assists)}
        </strong>
        <div className="archive-match-row__metrics">
          <span>{formatStat(match.goldPerMinute)} <small>GPM</small></span>
          <span>{formatStat(match.xpPerMinute)} <small>XPM</small></span>
        </div>
        <span className="archive-match-row__duration">{formatDuration(match.durationSeconds)}</span>
      </Link>
    </li>
  );
}

function WorkspaceMessage({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'error' }) {
  return (
    <div className={`workspace-message workspace-message--${tone}`}>
      <span aria-hidden="true">{tone === 'error' ? '!' : '+'}</span>
      <p>{text}</p>
    </div>
  );
}

function formatRank(rankTier: number | null): string {
  if (rankTier === null) return 'Rank uncalibrated';
  const medal = Math.floor(rankTier / 10);
  const stars = rankTier % 10;
  return `Rank ${medal}.${stars}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('ru-RU');
}

function formatDate(timestamp: number | null): string {
  if (timestamp === null) return 'No matches';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(timestamp * 1_000),
  );
}

function formatMatchDate(timestamp: number | null): string {
  if (timestamp === null) return 'Unknown date';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1_000));
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatMode(mode: number | null): string {
  return { 1: 'All Pick', 22: 'Ranked', 23: 'Turbo' }[mode ?? -1] ?? 'Other mode';
}

function formatStat(value: number | null): string {
  return value === null ? '—' : String(value);
}
