import { useMemo, useState, type CSSProperties } from 'react';
import type { MatchSyncResult } from '../../shared/match-archive';
import type { Tables } from '../../shared/database.types';
import type { ArchiveSnapshot } from '../lib/archive';
import type { MatchSyncProgress } from '../lib/dota-api';
import {
  calculateArchiveAnalytics,
  DEFAULT_ARCHIVE_FILTERS,
  filterArchiveMatches,
  getModeLabelForFilter,
  getPositionLabelForFilter,
  type ArchiveFilters,
} from '../lib/archive-analytics';
import { ArchiveSyncPanel } from './ArchiveSyncPanel';

type PlayerAccount = Pick<
  Tables<'tracked_accounts'>,
  'id' | 'avatar_url' | 'persona_name' | 'rank_tier'
> & { dota_account_id: number };

type PlayerDashboardProps = {
  account: PlayerAccount | null;
  snapshot?: ArchiveSnapshot;
  heroNames: Record<number, string>;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  onRefresh: () => void;
  onSelectMatch: (matchId: number) => void;
  onSyncArchive: () => void;
  onSyncAllArchive: () => void;
  archiveSyncResult?: MatchSyncResult;
  archiveSyncError: Error | null;
  isArchiveSyncing: boolean;
  isArchiveSyncingAll: boolean;
  archiveSyncProgress: MatchSyncProgress | null;
};

const EMPTY_ARCHIVE_MATCHES: ArchiveSnapshot['matches'] = [];

export function PlayerDashboard({
  account,
  snapshot,
  heroNames,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  onSelectMatch,
  onSyncArchive,
  onSyncAllArchive,
  archiveSyncResult,
  archiveSyncError,
  isArchiveSyncing,
  isArchiveSyncingAll,
  archiveSyncProgress,
}: PlayerDashboardProps) {
  const [filters, setFilters] = useState<ArchiveFilters>(DEFAULT_ARCHIVE_FILTERS);
  const matches = snapshot?.matches ?? EMPTY_ARCHIVE_MATCHES;
  const filteredMatches = useMemo(
    () => filterArchiveMatches(matches, filters),
    [matches, filters],
  );
  const analytics = useMemo(
    () => calculateArchiveAnalytics(filteredMatches, heroNames),
    [filteredMatches, heroNames],
  );

  if (isLoading) {
    return <WorkspaceMessage text="Читаем личный архив из Supabase…" />;
  }
  if (error) {
    return <WorkspaceMessage text={error.message} tone="error" />;
  }
  if (!account) {
    return <WorkspaceMessage text="Профиль игрока не выбран." />;
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
            <span>{matches.length.toLocaleString('ru-RU')} indexed</span>
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
          <strong>{filteredMatches.length.toLocaleString('ru-RU')} matches in view</strong>
        </div>
        <FilterSelect
          label="Period"
          value={filters.period}
          onChange={(value) => setFilters((current) => ({ ...current, period: value as ArchiveFilters['period'] }))}
          options={[
            ['all', 'All time'],
            ['30d', 'Last 30 days'],
            ['90d', 'Last 90 days'],
            ['year', 'Last year'],
          ]}
        />
        <FilterSelect
          label="Mode"
          value={filters.mode}
          onChange={(value) => setFilters((current) => ({ ...current, mode: value as ArchiveFilters['mode'] }))}
          options={(['all', 'ranked', 'turbo', 'all-pick'] as const).map((value) => [
            value,
            getModeLabelForFilter(value),
          ])}
        />
        <FilterSelect
          label="Position"
          value={filters.position}
          onChange={(value) => setFilters((current) => ({ ...current, position: value as ArchiveFilters['position'] }))}
          options={(['all', 'carry', 'mid', 'offlane', 'support', 'hard-support'] as const).map(
            (value) => [value, getPositionLabelForFilter(value)],
          )}
        />
        <FilterSelect
          label="Result"
          value={filters.result}
          onChange={(value) => setFilters((current) => ({ ...current, result: value as ArchiveFilters['result'] }))}
          options={[
            ['all', 'All results'],
            ['wins', 'Wins only'],
            ['losses', 'Losses only'],
          ]}
        />
        <FilterSelect
          label="Queue"
          value={filters.party}
          onChange={(value) => setFilters((current) => ({ ...current, party: value as ArchiveFilters['party'] }))}
          options={[
            ['all', 'Solo / Party'],
            ['solo', 'Solo only'],
            ['party', 'Party only'],
          ]}
        />
        <HeroFilter
          value={filters.heroId}
          heroNames={heroNames}
          matches={matches}
          onChange={(heroId) => setFilters((current) => ({ ...current, heroId }))}
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
              <span className="card-heading__count">{analytics.matches} / {matches.length}</span>
            </div>
            <FormStrip form={analytics.form} />
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
              <span className="card-heading__count">{matches.length.toLocaleString('ru-RU')} indexed</span>
            </div>
            {filteredMatches.length === 0 ? (
              <div className="empty-state">Нет матчей под выбранные фильтры.</div>
            ) : (
              <div className="archive-match-table" role="list" aria-label="Архив матчей">
                {filteredMatches.slice(0, 100).map((match) => (
                  <ArchiveMatchRow
                    key={match.matchId}
                    match={match}
                    heroNames={heroNames}
                    onSelect={onSelectMatch}
                  />
                ))}
              </div>
            )}
            {filteredMatches.length > 100 ? (
              <p className="table-note">Показаны последние 100 матчей из текущего среза.</p>
            ) : null}
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
            <BreakdownList items={analytics.modes} />
            <div className="side-divider" />
            <span className="micro-label">QUEUE / TEMPO</span>
            <BreakdownList items={analytics.party} compact />
            <BreakdownList items={analytics.tempo} compact />
          </section>

          <section className="dashboard-card hero-pool-card" aria-labelledby="hero-pool-title">
            <div className="card-heading">
              <div>
                <span className="micro-label">HERO POOL / REPEAT SIGNAL</span>
                <h3 id="hero-pool-title">Most played</h3>
              </div>
            </div>
            <HeroPool heroes={analytics.heroes.slice(0, 6)} />
          </section>

          <section className="dashboard-card lane-card" aria-labelledby="lane-title">
            <div className="card-heading">
              <div>
                <span className="micro-label">POSITION / LANE</span>
                <h3 id="lane-title">Role record</h3>
              </div>
            </div>
            <BreakdownList items={analytics.positions} />
            <BreakdownList items={analytics.lanes} compact />
          </section>

          <ArchiveSyncPanel
            accountName={account.persona_name ?? 'Dota player'}
            result={archiveSyncResult}
            syncState={snapshot?.syncState}
            archivedCount={matches.length}
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

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="filter-select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function HeroFilter({
  value,
  heroNames,
  matches,
  onChange,
}: {
  value: number | null;
  heroNames: Record<number, string>;
  matches: ArchiveSnapshot['matches'];
  onChange: (heroId: number | null) => void;
}) {
  const heroIds = [...new Set(matches.flatMap((match) => (match.heroId === null ? [] : [match.heroId])))].sort(
    (left, right) => (heroNames[left] ?? '').localeCompare(heroNames[right] ?? ''),
  );

  return (
    <label className="filter-select">
      <span>Hero</span>
      <select
        value={value === null ? 'all' : String(value)}
        onChange={(event) => onChange(event.target.value === 'all' ? null : Number(event.target.value))}
      >
        <option value="all">All heroes</option>
        {heroIds.map((heroId) => (
          <option key={heroId} value={heroId}>
            {heroNames[heroId] ?? `Hero #${heroId}`}
          </option>
        ))}
      </select>
    </label>
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
}: {
  heroes: Array<{
    heroId: number;
    label: string;
    matches: number;
    winRate: number;
    averageKda: number;
  }>;
}) {
  const maxMatches = heroes[0]?.matches ?? 1;
  return (
    <div className="hero-pool">
      {heroes.length === 0 ? <span className="breakdown-list__empty">No hero data</span> : null}
      {heroes.map((hero) => (
        <div className="hero-pool__row" key={hero.heroId}>
          <span className="hero-pool__portrait" aria-hidden="true">
            {hero.label.slice(0, 2).toUpperCase()}
          </span>
          <div className="hero-pool__copy">
            <strong>{hero.label}</strong>
            <span>{hero.matches} games · {hero.averageKda.toFixed(1)} KDA</span>
          </div>
          <strong className="hero-pool__rate">{hero.winRate}%</strong>
          <span
            className="hero-pool__bar"
            style={{ '--hero-share': `${(hero.matches / maxMatches) * 100}%` } as CSSProperties}
          />
        </div>
      ))}
    </div>
  );
}

function ArchiveMatchRow({
  match,
  heroNames,
  onSelect,
}: {
  match: ArchiveSnapshot['matches'][number];
  heroNames: Record<number, string>;
  onSelect: (matchId: number) => void;
}) {
  const result = match.won === true ? 'WIN' : match.won === false ? 'LOSS' : '—';
  const resultClass = match.won === true ? 'is-win' : match.won === false ? 'is-loss' : 'is-unknown';
  return (
    <button
      className={`archive-match-row ${resultClass}`}
      type="button"
      role="listitem"
      onClick={() => onSelect(match.matchId)}
      aria-label={`Открыть матч ${match.matchId}`}
    >
      <span className="archive-match-row__result">{result}</span>
      <span className="archive-match-row__hero-mark" aria-hidden="true">
        {match.heroId === null ? '?' : (heroNames[match.heroId] ?? `#${match.heroId}`).slice(0, 2).toUpperCase()}
      </span>
      <div className="archive-match-row__identity">
        <strong>{match.heroId === null ? 'Unknown hero' : heroNames[match.heroId] ?? `Hero #${match.heroId}`}</strong>
        <span>{formatMatchDate(match.startTime)} · {formatMode(match.gameMode)}</span>
      </div>
      <strong className="archive-match-row__kda">
        {match.kills ?? 0} / {match.deaths ?? 0} / {match.assists ?? 0}
      </strong>
      <div className="archive-match-row__metrics">
        <span>{match.goldPerMinute ?? 0} <small>GPM</small></span>
        <span>{match.xpPerMinute ?? 0} <small>XPM</small></span>
      </div>
      <span className="archive-match-row__duration">{formatDuration(match.durationSeconds)}</span>
    </button>
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
