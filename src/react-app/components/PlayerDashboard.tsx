import { type CSSProperties, useState } from 'react';
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
import { PeriodFilter } from './PeriodFilter';
import { useTranslation } from '../lib/i18n';

type PlayerAccount = Pick<
  Tables<'tracked_accounts'>,
  'avatar_url' | 'persona_name' | 'rank_tier'
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
  syncControls?: {
    onSyncArchive: () => void;
    onSyncAllArchive: () => void;
    archiveSyncResult?: MatchSyncResult;
    archiveSyncError: Error | null;
    isArchiveSyncing: boolean;
    isArchiveSyncingAll: boolean;
    archiveSyncProgress: MatchSyncProgress | null;
  };
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
  syncControls,
}: PlayerDashboardProps) {
  const { t, locale } = useTranslation();
  const [heroSort, setHeroSort] = useState<'played' | 'winrate' | 'lossrate'>('played');
  const [minGames, setMinGames] = useState<number>(10);
  const analytics = overview?.summary;
  const matches = page?.matches ?? [];

  const filteredHeroes = (overview?.heroes ?? []).filter((h) => h.matches >= minGames);

  const sortedHeroes = [...filteredHeroes].sort((a, b) => {
    if (heroSort === 'winrate') {
      if (b.winRate !== a.winRate) {
        return b.winRate - a.winRate;
      }
      return b.matches - a.matches;
    } else if (heroSort === 'lossrate') {
      if (a.winRate !== b.winRate) {
        return a.winRate - b.winRate;
      }
      return b.matches - a.matches;
    } else {
      if (b.matches !== a.matches) {
        return b.matches - a.matches;
      }
      return b.winRate - a.winRate;
    }
  });

  if (isLoading && !overview) {
    return <WorkspaceMessage text={t('loadingPersonalArchive')} />;
  }
  if (error) {
    return <WorkspaceMessage text={error.message} tone="error" />;
  }
  if (!account) {
    return <WorkspaceMessage text={t('profileNotSelected')} />;
  }
  if (!overview || !analytics) {
    return <WorkspaceMessage text={t('archiveNoOverview')} />;
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
            {account.persona_name ?? t('unknownPlayerName')}
            <span className="player-identity__tag">#{account.dota_account_id}</span>
          </h2>
          <div className="player-identity__meta">
            <span>{formatRank(account.rank_tier, t)}</span>
            <span>{syncControls ? 'Personal match archive' : 'Public read-only showcase'}</span>
            <span>{overview.integrity.linked.toLocaleString(locale)}{t('indexedSuffix')}</span>
            <span>{overview.integrity.complete} complete · {overview.integrity.missingStats} missing stats · {overview.integrity.missingMatch} missing match</span>
          </div>
        </div>
        <div className="player-identity__actions">
          <button
            className="icon-button"
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={t('refreshArchiveAriaLabel')}
          >
            {isRefreshing ? '…' : '↻'}
          </button>
          <span className="player-identity__stamp">M/L · 2026</span>
        </div>
      </header>

      <div className="archive-control-bar">
        <div className="filter-heading">
          <span className="micro-label">FILTER THE SIGNAL</span>
          <strong>{formatNumber(analytics.matches, locale)} matches in view</strong>
        </div>
        <PeriodFilter
          period={filters.period}
          startDate={filters.startDate}
          endDate={filters.endDate}
          onChange={(period) => onFiltersChange({ ...filters, ...period })}
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
          value={formatNumber(analytics.matches, locale)}
          detail={`${formatDate(analytics.firstMatchAt, locale)} → ${formatDate(analytics.latestMatchAt, locale)}`}
          tone="acid"
        />
        <MetricCard
          label="Win rate"
          value={`${analytics.winRate}%`}
          detail={`${analytics.wins} W · ${analytics.losses} L`}
          tone={analytics.winRate > 50 ? 'acid' : analytics.winRate < 50 ? 'red' : 'violet'}
          status={analytics.winRate > 50 ? 'Above even' : analytics.winRate < 50 ? 'Below even' : 'Even'}
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
            <FormStrip form={overview.form} t={t} />
            <div className="form-card__footer">
              <span>{analytics.wins}{t('winsInView')}</span>
              <span>{analytics.averageDurationMinutes}{t('durationSuffix')}</span>
            </div>
          </section>

          <section className="dashboard-card matches-card" aria-labelledby="matches-title">
            <div className="card-heading">
              <div>
                <span className="micro-label">ARCHIVE / MATCH LOG</span>
                <h3 id="matches-title">Matches</h3>
              </div>
              <span className="card-heading__count">{overview.integrity.complete.toLocaleString(locale)} complete</span>
            </div>
            {isLoading && !page ? (
              <div className="empty-state">{t('loadingMatchesList')}</div>
            ) : matches.length === 0 ? (
              <div className="empty-state">{t('noMatchesForFilters')}</div>
            ) : (
              <ul className="archive-match-table" aria-label={t('matchArchiveAriaLabel')}>
                {matches.map((match) => (
                  <ArchiveMatchRow
                    key={match.matchId}
                    match={match}
                    heroNames={heroNames}
                    playerId={account.dota_account_id}
                    t={t}
                    locale={locale}
                  />
                ))}
              </ul>
            )}
            <div className="table-note">
              <button
                className="table-note__button"
                type="button"
                onClick={onPreviousPage}
                disabled={!hasPreviousPage || isRefreshing}
              >
                Previous
              </button>
              <button
                className="table-note__button"
                type="button"
                onClick={() => page?.nextCursor && onNextPage(page.nextCursor)}
                disabled={!page?.nextCursor || isRefreshing}
              >
                Next
              </button>
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
                <h3 id="hero-pool-title">
                  {heroSort === 'played' ? 'Most played' : heroSort === 'winrate' ? 'Highest win rate' : 'Highest loss rate'}
                </h3>
              </div>
              {filters.heroId !== null ? (
                <button
                  className="hero-pool__reset"
                  type="button"
                  aria-label={t('resetHeroFilterAriaLabel')}
                  title={t('resetHeroFilterAriaLabel')}
                  onClick={() => onFiltersChange({ ...filters, heroId: null })}
                >
                  <span aria-hidden="true">×</span>
                </button>
              ) : null}
            </div>
            <div className="hero-pool__tabs">
              <button
                className={`hero-pool__tab ${heroSort === 'played' ? 'is-active' : ''}`}
                onClick={() => setHeroSort('played')}
                type="button"
              >
                Top played
              </button>
              <button
                className={`hero-pool__tab ${heroSort === 'winrate' ? 'is-active' : ''}`}
                onClick={() => setHeroSort('winrate')}
                type="button"
              >
                Win rate
              </button>
              <button
                className={`hero-pool__tab ${heroSort === 'lossrate' ? 'is-active' : ''}`}
                onClick={() => setHeroSort('lossrate')}
                type="button"
              >
                Loss rate
              </button>
            </div>
            <div className="hero-pool__settings">
              <span>Min games:</span>
              <div className="hero-pool__min-games-buttons">
                {([1, 2, 5, 10, 20] as const).map((g) => (
                  <button
                    key={g}
                    className={`hero-pool__setting-btn ${minGames === g ? 'is-active' : ''}`}
                    onClick={() => setMinGames(g)}
                    type="button"
                    aria-label={`Show heroes with at least ${g} games`}
                  >
                    {g === 1 ? '1+' : `${g}+`}
                  </button>
                ))}
              </div>
            </div>
            <HeroPool
              heroes={sortedHeroes.slice(0, 6).map((hero) => ({ ...hero, label: heroNames[hero.heroId] ?? `Hero #${hero.heroId}` }))}
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

          {syncControls ? <ArchiveSyncPanel
            accountName={account.persona_name ?? t('unknownPlayerName')}
            result={syncControls.archiveSyncResult}
            syncState={overview.syncState}
            archivedCount={overview.integrity.linked}
            isPending={syncControls.isArchiveSyncing}
            isSyncingAll={syncControls.isArchiveSyncingAll}
            fullSyncProgress={syncControls.archiveSyncProgress}
            error={syncControls.archiveSyncError}
            onSync={syncControls.onSyncArchive}
            onSyncAll={syncControls.onSyncAllArchive}
          /> : null}
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

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  tone: 'acid' | 'red' | 'violet' | 'blue';
  progress?: number;
  status?: string;
};

function MetricCard({
  label,
  value,
  detail,
  tone,
  progress,
  status,
}: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__header">
        <span className="micro-label">{label}</span>
        {status ? <span className="metric-card__status">{status}</span> : null}
      </div>
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

function FormStrip({ form, t }: { form: Array<'win' | 'loss' | 'unknown'>; t: (key: any) => string }) {
  return (
    <div className="form-strip" aria-label={t('recentFormAriaLabel')}>
      {form.length === 0 ? (
        <span className="form-strip__empty">No data yet</span>
      ) : (
        form.map((result, index) => (
          <span
            key={`${result}-${index}`}
            className={`form-strip__cell form-strip__cell--${result}`}
            title={result === 'win' ? t('recentFormTooltipWin') : result === 'loss' ? t('recentFormTooltipLoss') : t('recentFormTooltipUnknown')}
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
          <strong className={`hero-pool__rate${hero.winRate < 50 ? ' is-loss' : ''}`}>{hero.winRate}%</strong>
        </button>
      ))}
    </div>
  );
}

function ArchiveMatchRow({
  match,
  heroNames,
  playerId,
  t,
  locale,
}: {
  match: ArchivePage['matches'][number];
  heroNames: Record<number, string>;
  playerId: number;
  t: (key: any, reqs?: any) => string;
  locale: string;
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
        aria-label={t('openMatchAriaLabel', { matchId: match.matchId })}
      >
        <span className="archive-match-row__result">{result}</span>
        <HeroMark heroId={match.heroId} label={heroLabel} fallback={heroFallback} className="archive-match-row__hero-mark" />
        <div className="archive-match-row__identity">
          <strong>{heroLabel}</strong>
          <span>
            {formatMatchDate(match.startTime, locale)} · {formatMode(match.gameMode)}
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

function formatRank(rankTier: number | null, t: (key: any) => string): string {
  if (rankTier === null) return t('rankUncalibrated');
  const medal = Math.floor(rankTier / 10);
  const stars = rankTier % 10;
  return `${t('rankPrefix')} ${medal}.${stars}`;
}

function formatNumber(value: number, locale: string): string {
  return value.toLocaleString(locale);
}

function formatDate(timestamp: number | null, locale: string): string {
  if (timestamp === null) return 'No matches';
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(timestamp * 1_000),
  );
}

function formatMatchDate(timestamp: number | null, locale: string): string {
  if (timestamp === null) return 'Unknown date';
  return new Intl.DateTimeFormat(locale, {
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
