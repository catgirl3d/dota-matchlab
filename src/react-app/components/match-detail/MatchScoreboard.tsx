import { useState } from 'react';
import type { MatchDetailPlayer } from '../../lib/match-detail';
import { getItemIcon } from '../../lib/item-icons';
import { getPositionIcon } from '../../lib/position-icons';
import { useTranslation, type TranslationKey } from '../../lib/i18n';
import { HeroMark } from '../HeroMark';
import { PlayerSortControls, type PlayerSort } from '../PlayerSortControls';
import { Tooltip } from '../Tooltip';
import { formatAccount, formatCompact, formatEnum, heroLabel, heroMark } from './match-detail-display';
import { sortPlayers } from './match-detail-player';
import { DetailHeading } from './match-detail-primitives';
import { ScoreboardTeamMetricCard, type ScoreboardTeamMetric } from './ScoreboardTeamMetricCard';

type PerformanceRank = 1 | 2;
type PlayerAchievement = 'mvp' | 'top-imp' | 'most-damage' | 'most-tower-damage';
type ScoreboardView = 'roster' | 'table';
type ScoreboardRecordMetric =
  | 'kills'
  | 'deaths'
  | 'assists'
  | 'netWorth'
  | 'imp'
  | 'lastHits'
  | 'denies'
  | 'goldPerMinute'
  | 'xpPerMinute'
  | 'heroDamage'
  | 'towerDamage'
  | 'heroHealing';
type ScoreboardRecords = Partial<Record<ScoreboardRecordMetric, number>>;

const SCOREBOARD_RECORD_METRICS: ReadonlyArray<{
  metric: ScoreboardRecordMetric;
  direction: 'highest' | 'lowest';
}> = [
  { metric: 'kills', direction: 'highest' },
  { metric: 'deaths', direction: 'lowest' },
  { metric: 'assists', direction: 'highest' },
  { metric: 'netWorth', direction: 'highest' },
  { metric: 'imp', direction: 'highest' },
  { metric: 'lastHits', direction: 'highest' },
  { metric: 'denies', direction: 'highest' },
  { metric: 'goldPerMinute', direction: 'highest' },
  { metric: 'xpPerMinute', direction: 'highest' },
  { metric: 'heroDamage', direction: 'highest' },
  { metric: 'towerDamage', direction: 'highest' },
  { metric: 'heroHealing', direction: 'highest' },
];

const PLAYER_ACHIEVEMENTS: Record<PlayerAchievement, { label: string; title: string }> = {
  mvp: { label: 'MVP', title: 'Highest Individual Match Performance' },
  'top-imp': { label: 'TOP 2 IMP', title: 'Second-highest Individual Match Performance' },
  'most-damage': { label: 'MOST DMG', title: 'Highest hero damage' },
  'most-tower-damage': { label: 'MOST TD', title: 'Highest tower damage' },
};

type MatchScoreboardProps = {
  radiantPlayers: MatchDetailPlayer[];
  direPlayers: MatchDetailPlayer[];
  heroNames: Record<number, string>;
  currentAccountId: number | null;
};

export function MatchScoreboard({
  radiantPlayers,
  direPlayers,
  heroNames,
  currentAccountId,
}: MatchScoreboardProps) {
  const [sort, setSort] = useState<PlayerSort>('slot');
  const [view, setView] = useState<ScoreboardView>('table');
  const [selectedPlayerKey, setSelectedPlayerKey] = useState<string | null>(null);
  const players = [...radiantPlayers, ...direPlayers];
  const performanceRanks = rankPlayersByImp(players);
  const playerAchievements = getPlayerAchievements(players, performanceRanks);

  return (
    <section className="detail-panel detail-scoreboard" aria-labelledby="scoreboard-title">
      <div className="detail-scoreboard__header">
        <DetailHeading eyebrow="MATCHUP / SCOREBOARD" title="Ten-player breakdown" id="scoreboard-title" />
        <div className="detail-scoreboard__controls">
          <PlayerSortControls value={sort} onChange={setSort} ariaLabel="Sort ten-player breakdown" />
          <ScoreboardViewControls value={view} onChange={setView} />
        </div>
      </div>
      {view === 'roster' ? (
        <div className="detail-scoreboard__teams">
          <TeamRoster
            label="Radiant"
            players={radiantPlayers}
            heroNames={heroNames}
            currentAccountId={currentAccountId}
            sort={sort}
            performanceRanks={performanceRanks}
            playerAchievements={playerAchievements}
          />
          <div className="detail-scoreboard__versus">VS</div>
          <TeamRoster
            label="Dire"
            players={direPlayers}
            heroNames={heroNames}
            currentAccountId={currentAccountId}
            sort={sort}
            performanceRanks={performanceRanks}
            playerAchievements={playerAchievements}
          />
        </div>
      ) : (
        <ScoreboardTable
          radiantPlayers={radiantPlayers}
          direPlayers={direPlayers}
          heroNames={heroNames}
          currentAccountId={currentAccountId}
          sort={sort}
          performanceRanks={performanceRanks}
          playerAchievements={playerAchievements}
          selectedPlayerKey={selectedPlayerKey}
          onPlayerSelect={setSelectedPlayerKey}
        />
      )}
    </section>
  );
}

function ScoreboardViewControls({
  value,
  onChange,
}: {
  value: ScoreboardView;
  onChange: (value: ScoreboardView) => void;
}) {
  return (
    <div className="scoreboard-view-switch" role="group" aria-label="Scoreboard view">
      <span className="micro-label">VIEW</span>
      <div className="scoreboard-view-switch__options">
        <button
          className={value === 'roster' ? 'is-active' : ''}
          type="button"
          title="Split roster view"
          aria-label="Split roster view"
          aria-pressed={value === 'roster'}
          onClick={() => onChange('roster')}
        >
          <SplitRosterIcon />
        </button>
        <button
          className={value === 'table' ? 'is-active' : ''}
          type="button"
          title="Table view"
          aria-label="Table view"
          aria-pressed={value === 'table'}
          onClick={() => onChange('table')}
        >
          <TableIcon />
        </button>
      </div>
    </div>
  );
}

function TeamRoster({
  label,
  players,
  heroNames,
  currentAccountId,
  sort,
  performanceRanks,
  playerAchievements,
}: {
  label: string;
  players: MatchDetailPlayer[];
  heroNames: Record<number, string>;
  currentAccountId: number | null;
  sort: PlayerSort;
  performanceRanks: Map<string, PerformanceRank>;
  playerAchievements: Map<string, PlayerAchievement[]>;
}) {
  const orderedPlayers = sortPlayers(players, sort);

  return (
    <div className="team-roster">
      <span className="team-roster__label">{label}</span>
      {orderedPlayers.map((player) => {
        const performanceRank = performanceRanks.get(player.key);
        const achievements = playerAchievements.get(player.key) ?? [];
        const playerLabel = player.name ?? formatAccount(player.accountId);

        return (
          <article
            className={scoreboardPlayerClass(player, performanceRank, currentAccountId)}
            key={player.key}
            aria-label={`Scoreboard entry for ${playerLabel}`}
          >
            <ScoreboardHeroWithPosition heroId={player.heroId} heroNames={heroNames} position={player.position} role={player.role} />
            <div className="scoreboard-player__identity">
              <strong>{playerLabel}</strong>
              <span>{heroLabel(player.heroId, heroNames)} · {formatEnum(player.role ?? 'UNKNOWN')}</span>
              <AchievementBadges achievements={achievements} />
            </div>
            <div className="scoreboard-player__kda" role="group" aria-label={`${player.kills} kills, ${player.deaths} deaths, ${player.assists} assists`}>
              <span><ScoreboardMetricLabel label="K" tooltipKey="scoreboardMetricKills" compact /><strong>{player.kills}</strong></span>
              <span><ScoreboardMetricLabel label="D" tooltipKey="scoreboardMetricDeaths" compact /><strong>{player.deaths}</strong></span>
              <span><ScoreboardMetricLabel label="A" tooltipKey="scoreboardMetricAssists" compact /><strong>{player.assists}</strong></span>
            </div>
            <div className="scoreboard-player__economy">
              <span><ScoreboardMetricLabel label="GPM" tooltipKey="scoreboardMetricGoldPerMinute" compact /><strong>{player.goldPerMinute}</strong></span>
              <span><ScoreboardMetricLabel label="XPM" tooltipKey="scoreboardMetricExperiencePerMinute" compact /><strong>{player.xpPerMinute}</strong></span>
            </div>
            <span className="scoreboard-player__net"><ScoreboardMetricLabel label="NET" tooltipKey="scoreboardMetricNetWorth" compact /><strong>{formatCompact(player.netWorth)}</strong></span>
          </article>
        );
      })}
    </div>
  );
}

function ScoreboardTable({
  radiantPlayers,
  direPlayers,
  heroNames,
  currentAccountId,
  sort,
  performanceRanks,
  playerAchievements,
  selectedPlayerKey,
  onPlayerSelect,
}: {
  radiantPlayers: MatchDetailPlayer[];
  direPlayers: MatchDetailPlayer[];
  heroNames: Record<number, string>;
  currentAccountId: number | null;
  sort: PlayerSort;
  performanceRanks: Map<string, PerformanceRank>;
  playerAchievements: Map<string, PlayerAchievement[]>;
  selectedPlayerKey: string | null;
  onPlayerSelect: (playerKey: string | null) => void;
}) {
  const orderedRadiantPlayers = sortPlayers(radiantPlayers, sort);
  const orderedDirePlayers = sortPlayers(direPlayers, sort);
  const records = getScoreboardRecords([...radiantPlayers, ...direPlayers]);
  const selectedPlayer = [...radiantPlayers, ...direPlayers].find((player) => player.key === selectedPlayerKey) ?? null;
  const selectedPlayerLabel = selectedPlayer === null
    ? null
    : selectedPlayer.name ?? heroLabel(selectedPlayer.heroId, heroNames);

  return (
    <div className="scoreboard-table-scroll">
      <table className="scoreboard-table" aria-label="Ten-player scoreboard table">
        <thead>
          <tr>
            <ScoreboardTableHeader label="Hero" tooltipKey="scoreboardMetricHero" />
            <ScoreboardTableHeader label="Player" tooltipKey="scoreboardMetricPlayer" />
            <ScoreboardTableHeader label="K / D / A" tooltipKey="scoreboardMetricKda" />
            <ScoreboardTableHeader label="NET" tooltipKey="scoreboardMetricNetWorth" />
            <ScoreboardTableHeader label="IMP" tooltipKey="scoreboardMetricImp" />
            <ScoreboardTableHeader label="LH / DN" tooltipKey="scoreboardMetricLastHitsDenies" />
            <ScoreboardTableHeader label="GPM / XPM" tooltipKey="scoreboardMetricGoldExperiencePerMinute" />
            <ScoreboardTableHeader label="HD" tooltipKey="scoreboardMetricHeroDamage" />
            <ScoreboardTableHeader label="TD" tooltipKey="scoreboardMetricTowerDamage" />
            <ScoreboardTableHeader label="HH" tooltipKey="scoreboardMetricHeroHealing" />
            <ScoreboardTableHeader label="Inventory" tooltipKey="scoreboardMetricInventory" />
          </tr>
        </thead>
        <tbody>
          {orderedRadiantPlayers.map((player) => (
            <ScoreboardTableRow
              player={player}
              heroNames={heroNames}
              currentAccountId={currentAccountId}
              performanceRank={performanceRanks.get(player.key)}
              achievements={playerAchievements.get(player.key) ?? []}
              records={records}
              isContributionSelected={selectedPlayerKey === player.key}
              onContributionSelect={() => onPlayerSelect(selectedPlayerKey === player.key ? null : player.key)}
              key={player.key}
            />
          ))}
          {orderedDirePlayers.length > 0 ? (
            <tr className="scoreboard-table__team-break">
              <td colSpan={11}>Dire</td>
            </tr>
          ) : null}
          {orderedDirePlayers.map((player) => (
            <ScoreboardTableRow
              player={player}
              heroNames={heroNames}
              currentAccountId={currentAccountId}
              performanceRank={performanceRanks.get(player.key)}
              achievements={playerAchievements.get(player.key) ?? []}
              records={records}
              isContributionSelected={selectedPlayerKey === player.key}
              onContributionSelect={() => onPlayerSelect(selectedPlayerKey === player.key ? null : player.key)}
              key={player.key}
            />
          ))}
        </tbody>
        <tfoot>
          {radiantPlayers.length > 0 || direPlayers.length > 0 ? <ScoreboardTeamTotalsHeading /> : null}
          {radiantPlayers.length > 0 ? <ScoreboardTeamTotalsRow team="radiant" players={radiantPlayers} /> : null}
          {direPlayers.length > 0 ? <ScoreboardTeamTotalsRow team="dire" players={direPlayers} /> : null}
          {radiantPlayers.length > 0 || direPlayers.length > 0 ? <ScoreboardTeamTotalsPreview radiantPlayers={radiantPlayers} direPlayers={direPlayers} selectedPlayer={selectedPlayer} selectedPlayerLabel={selectedPlayerLabel} /> : null}
        </tfoot>
      </table>
    </div>
  );
}

function ScoreboardTableRow({
  player,
  heroNames,
  currentAccountId,
  performanceRank,
  achievements,
  records,
  isContributionSelected,
  onContributionSelect,
}: {
  player: MatchDetailPlayer;
  heroNames: Record<number, string>;
  currentAccountId: number | null;
  performanceRank: PerformanceRank | undefined;
  achievements: PlayerAchievement[];
  records: ScoreboardRecords;
  isContributionSelected: boolean;
  onContributionSelect: () => void;
}) {
  const playerLabel = player.name ?? formatAccount(player.accountId);

  return (
    <tr
      className={`${scoreboardTableRowClass(player, performanceRank, currentAccountId)}${isContributionSelected ? ' is-contribution-selected' : ''}`}
      aria-label={`Scoreboard row for ${playerLabel}`}
      tabIndex={0}
      onClick={onContributionSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onContributionSelect();
        }
      }}
    >
      <td className="scoreboard-table__hero-cell">
        <ScoreboardHeroWithPosition heroId={player.heroId} heroNames={heroNames} position={player.position} role={player.role} />
      </td>
      <th className="scoreboard-table__player" scope="row">
        <span className="scoreboard-table__player-content">
          <span className="scoreboard-table__level">{player.level}</span>
          <span className="scoreboard-table__player-copy">
            <strong>{playerLabel}</strong>
            <AchievementBadges achievements={achievements} />
          </span>
        </span>
      </th>
      <td className="scoreboard-table__numeric" aria-label={`${player.kills} kills, ${player.deaths} deaths, ${player.assists} assists`}>
        <ScoreboardMetricValue value={String(player.kills)} tooltipKey="scoreboardMetricKills" isRecord={isScoreboardRecord(records, 'kills', player.kills)} />
        {' / '}
        <ScoreboardMetricValue value={String(player.deaths)} tooltipKey="scoreboardMetricDeaths" isRecord={isScoreboardRecord(records, 'deaths', player.deaths)} />
        {' / '}
        <ScoreboardMetricValue value={String(player.assists)} tooltipKey="scoreboardMetricAssists" isRecord={isScoreboardRecord(records, 'assists', player.assists)} />
      </td>
      <td className="scoreboard-table__numeric">
        <ScoreboardMetricValue value={formatCompact(player.netWorth)} tooltipKey="scoreboardMetricNetWorth" isRecord={isScoreboardRecord(records, 'netWorth', player.netWorth)} />
      </td>
      <td className={`scoreboard-table__numeric scoreboard-table__imp${player.imp === null ? ' is-unavailable' : player.imp > 0 ? ' is-positive' : player.imp < 0 ? ' is-negative' : ''}`}>
        <ScoreboardMetricValue value={formatImp(player.imp)} tooltipKey="scoreboardMetricImp" isRecord={isScoreboardRecord(records, 'imp', player.imp)} />
      </td>
      <td className="scoreboard-table__numeric">
        <ScoreboardMetricValue value={String(player.lastHits)} tooltipKey="scoreboardMetricLastHits" isRecord={isScoreboardRecord(records, 'lastHits', player.lastHits)} />
        {' / '}
        <ScoreboardMetricValue value={String(player.denies)} tooltipKey="scoreboardMetricDenies" isRecord={isScoreboardRecord(records, 'denies', player.denies)} />
      </td>
      <td className="scoreboard-table__numeric">
        <ScoreboardMetricValue value={formatCompact(player.goldPerMinute)} tooltipKey="scoreboardMetricGoldPerMinute" isRecord={isScoreboardRecord(records, 'goldPerMinute', player.goldPerMinute)} />
        {' / '}
        <ScoreboardMetricValue value={formatCompact(player.xpPerMinute)} tooltipKey="scoreboardMetricExperiencePerMinute" isRecord={isScoreboardRecord(records, 'xpPerMinute', player.xpPerMinute)} />
      </td>
      <td className="scoreboard-table__numeric">
        <ScoreboardMetricValue value={formatCompact(player.heroDamage)} tooltipKey="scoreboardMetricHeroDamage" isRecord={isScoreboardRecord(records, 'heroDamage', player.heroDamage)} />
      </td>
      <td className="scoreboard-table__numeric">
        <ScoreboardMetricValue value={formatCompact(player.towerDamage)} tooltipKey="scoreboardMetricTowerDamage" isRecord={isScoreboardRecord(records, 'towerDamage', player.towerDamage)} />
      </td>
      <td className="scoreboard-table__numeric">
        <ScoreboardMetricValue value={formatCompact(player.heroHealing)} tooltipKey="scoreboardMetricHeroHealing" isRecord={isScoreboardRecord(records, 'heroHealing', player.heroHealing)} />
      </td>
      <td>
        <ScoreboardInventory
          itemIds={player.itemIds}
          neutralItemId={player.neutralItemId}
          permanentUpgradeItemIds={player.permanentUpgradeItemIds}
        />
      </td>
    </tr>
  );
}

function ScoreboardTableHeader({ label, tooltipKey }: { label: string; tooltipKey: TranslationKey }) {
  return (
    <th scope="col">
      <ScoreboardMetricLabel label={label} tooltipKey={tooltipKey} />
    </th>
  );
}

function ScoreboardMetricLabel({
  label,
  tooltipKey,
  compact = false,
}: {
  label: string;
  tooltipKey: TranslationKey;
  compact?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Tooltip content={t(tooltipKey)} focusable={false}>
      {compact ? <small>{label}</small> : <span>{label}</span>}
    </Tooltip>
  );
}

function ScoreboardTeamTotalsHeading() {
  const { t } = useTranslation();
  return <tr className="scoreboard-table__totals-heading"><th colSpan={11} scope="rowgroup">{t('scoreboardTeamTotals')}</th></tr>;
}

function ScoreboardTeamTotalsRow({
  team,
  players,
}: {
  team: 'radiant' | 'dire';
  players: MatchDetailPlayer[];
}) {
  const { t } = useTranslation();
  const totals = getScoreboardTeamTotals(players);
  const teamLabel = team === 'radiant' ? t('scoreboardTeamRadiant') : t('scoreboardTeamDire');
  const totalLabel = t('scoreboardTeamTotal', { team: teamLabel });

  return (
    <tr className={`scoreboard-table__team-total scoreboard-table__team-total--${team}`} aria-label={totalLabel}>
      <th className="scoreboard-table__team-total-label" colSpan={2} scope="row">{totalLabel}</th>
      <td className="scoreboard-table__numeric">
        <ScoreboardMetricValue value={String(totals.kills)} tooltipKey="scoreboardMetricKills" />
        {' / '}
        <ScoreboardMetricValue value={String(totals.deaths)} tooltipKey="scoreboardMetricDeaths" />
        {' / '}
        <ScoreboardMetricValue value={String(totals.assists)} tooltipKey="scoreboardMetricAssists" />
      </td>
      <td className="scoreboard-table__numeric"><ScoreboardMetricValue value={formatCompact(totals.netWorth)} tooltipKey="scoreboardMetricNetWorth" /></td>
      <td className={`scoreboard-table__numeric scoreboard-table__imp${totals.imp === null ? ' is-unavailable' : totals.imp > 0 ? ' is-positive' : totals.imp < 0 ? ' is-negative' : ''}`}><ScoreboardMetricValue value={formatImp(totals.imp)} tooltipKey="scoreboardMetricImp" /></td>
      <td className="scoreboard-table__numeric">
        <ScoreboardMetricValue value={String(totals.lastHits)} tooltipKey="scoreboardMetricLastHits" />
        {' / '}
        <ScoreboardMetricValue value={String(totals.denies)} tooltipKey="scoreboardMetricDenies" />
      </td>
      <td className="scoreboard-table__numeric">
        <ScoreboardMetricValue value={formatCompact(totals.goldPerMinute)} tooltipKey="scoreboardMetricGoldPerMinute" />
        {' / '}
        <ScoreboardMetricValue value={formatCompact(totals.xpPerMinute)} tooltipKey="scoreboardMetricExperiencePerMinute" />
      </td>
      <td className="scoreboard-table__numeric"><ScoreboardMetricValue value={formatCompact(totals.heroDamage)} tooltipKey="scoreboardMetricHeroDamage" /></td>
      <td className="scoreboard-table__numeric"><ScoreboardMetricValue value={formatCompact(totals.towerDamage)} tooltipKey="scoreboardMetricTowerDamage" /></td>
      <td className="scoreboard-table__numeric"><ScoreboardMetricValue value={formatCompact(totals.heroHealing)} tooltipKey="scoreboardMetricHeroHealing" /></td>
      <td aria-hidden="true" />
    </tr>
  );
}

function ScoreboardTeamTotalsPreview({
  radiantPlayers,
  direPlayers,
  selectedPlayer,
  selectedPlayerLabel,
}: {
  radiantPlayers: MatchDetailPlayer[];
  direPlayers: MatchDetailPlayer[];
  selectedPlayer: MatchDetailPlayer | null;
  selectedPlayerLabel: string | null;
}) {
  const { t } = useTranslation();
  const [focusedMetricId, setFocusedMetricId] = useState<string | null>(null);
  const radiant = getScoreboardTeamTotals(radiantPlayers);
  const dire = getScoreboardTeamTotals(direPlayers);
  const contribution = (value: number) => selectedPlayer === null || selectedPlayerLabel === null
    ? undefined
    : { team: selectedPlayer.isRadiant ? 'radiant' as const : 'dire' as const, playerLabel: selectedPlayerLabel, value };

  return (
    <tr className="scoreboard-table__totals-preview">
      <td colSpan={11}>
        <section className="scoreboard-team-totals" aria-label={t('scoreboardTeamTotals')}>
          <header className="scoreboard-team-totals__header">
            <span className="micro-label">{t('scoreboardTeamTotals')}</span>
            <strong>{t('scoreboardTeamPerformance')}</strong>
          </header>
          <div className="scoreboard-team-totals__groups">
            <ScoreboardTeamMetricGroup label={t('scoreboardTeamTotalsKda')} focusedMetricId={focusedMetricId} onFocusChange={setFocusedMetricId} metrics={[
              { label: t('scoreboardMetricKills'), radiant: radiant.kills, dire: dire.kills, contribution: contribution(selectedPlayer?.kills ?? 0) },
              { label: t('scoreboardMetricDeaths'), radiant: radiant.deaths, dire: dire.deaths, direction: 'lowest', contribution: contribution(selectedPlayer?.deaths ?? 0) },
              { label: t('scoreboardMetricAssists'), radiant: radiant.assists, dire: dire.assists, contribution: contribution(selectedPlayer?.assists ?? 0) },
            ]} />
            <ScoreboardTeamMetricGroup label={t('scoreboardTeamTotalsEconomy')} focusedMetricId={focusedMetricId} onFocusChange={setFocusedMetricId} metrics={[
              { label: t('scoreboardMetricNetWorth'), radiant: radiant.netWorth, dire: dire.netWorth, format: 'compact', contribution: contribution(selectedPlayer?.netWorth ?? 0) },
              { label: t('scoreboardMetricGoldPerMinute'), radiant: radiant.goldPerMinute, dire: dire.goldPerMinute, format: 'compact', contribution: contribution(selectedPlayer?.goldPerMinute ?? 0) },
              { label: t('scoreboardMetricExperiencePerMinute'), radiant: radiant.xpPerMinute, dire: dire.xpPerMinute, format: 'compact', contribution: contribution(selectedPlayer?.xpPerMinute ?? 0) },
            ]} />
            <ScoreboardTeamMetricGroup label={t('scoreboardTeamTotalsFarm')} focusedMetricId={focusedMetricId} onFocusChange={setFocusedMetricId} metrics={[
              { label: t('scoreboardMetricLastHits'), radiant: radiant.lastHits, dire: dire.lastHits, format: 'compact', contribution: contribution(selectedPlayer?.lastHits ?? 0) },
              { label: t('scoreboardMetricDenies'), radiant: radiant.denies, dire: dire.denies, format: 'compact', contribution: contribution(selectedPlayer?.denies ?? 0) },
            ]} />
            <ScoreboardTeamMetricGroup label={t('scoreboardTeamTotalsDamage')} focusedMetricId={focusedMetricId} onFocusChange={setFocusedMetricId} metrics={[
              { label: t('scoreboardMetricHeroDamage'), radiant: radiant.heroDamage, dire: dire.heroDamage, format: 'compact', contribution: contribution(selectedPlayer?.heroDamage ?? 0) },
              { label: t('scoreboardMetricTowerDamage'), radiant: radiant.towerDamage, dire: dire.towerDamage, format: 'compact', contribution: contribution(selectedPlayer?.towerDamage ?? 0) },
              { label: t('scoreboardMetricHeroHealing'), radiant: radiant.heroHealing, dire: dire.heroHealing, format: 'compact', contribution: contribution(selectedPlayer?.heroHealing ?? 0) },
            ]} />
          </div>
        </section>
      </td>
    </tr>
  );
}

function ScoreboardTeamMetricGroup({
  label,
  metrics,
  focusedMetricId,
  onFocusChange,
}: {
  label: string;
  metrics: ScoreboardTeamMetric[];
  focusedMetricId: string | null;
  onFocusChange: (metricId: string | null) => void;
}) {
  return (
    <section className="scoreboard-team-totals__group" aria-label={label}>
      <span className="micro-label">{label}</span>
      <div className="scoreboard-team-totals__grid">
        {metrics.map((metric) => {
          const metricId = `${label}:${metric.label}`;
          return <ScoreboardTeamMetricCard
            group={label}
            focusedMetricId={focusedMetricId}
            metricId={metricId}
            onFocusChange={onFocusChange}
            {...metric}
            key={metric.label}
          />;
        })}
      </div>
    </section>
  );
}

function getScoreboardTeamTotals(players: MatchDetailPlayer[]) {
  return {
    kills: sumPlayerMetric(players, (player) => player.kills),
    deaths: sumPlayerMetric(players, (player) => player.deaths),
    assists: sumPlayerMetric(players, (player) => player.assists),
    netWorth: sumPlayerMetric(players, (player) => player.netWorth),
    imp: averagePlayerImp(players),
    lastHits: sumPlayerMetric(players, (player) => player.lastHits),
    denies: sumPlayerMetric(players, (player) => player.denies),
    goldPerMinute: sumPlayerMetric(players, (player) => player.goldPerMinute),
    xpPerMinute: sumPlayerMetric(players, (player) => player.xpPerMinute),
    heroDamage: sumPlayerMetric(players, (player) => player.heroDamage),
    towerDamage: sumPlayerMetric(players, (player) => player.towerDamage),
    heroHealing: sumPlayerMetric(players, (player) => player.heroHealing),
  };
}

function sumPlayerMetric(players: MatchDetailPlayer[], getValue: (player: MatchDetailPlayer) => number): number {
  return players.reduce((total, player) => total + getValue(player), 0);
}

function averagePlayerImp(players: MatchDetailPlayer[]): number | null {
  return players.some((player) => player.imp === null)
    ? null
    : players.reduce((total, player) => total + (player.imp ?? 0), 0) / players.length;
}

function ScoreboardMetricValue({
  value,
  tooltipKey,
  isRecord = false,
}: {
  value: string;
  tooltipKey: TranslationKey;
  isRecord?: boolean;
}) {
  const { t } = useTranslation();
  const metric = t(tooltipKey);
  const tooltip = isRecord ? t('scoreboardMetricBestInMatch', { metric }) : metric;

  return (
    <Tooltip content={tooltip} focusable={false}>
      <ScoreboardRecordValue value={value} isRecord={isRecord} />
    </Tooltip>
  );
}

function ScoreboardRecordValue({ value, isRecord }: { value: string; isRecord: boolean }) {
  return (
    <span className={isRecord ? 'scoreboard-table__record' : undefined}>
      {value}
    </span>
  );
}

function AchievementBadges({ achievements }: { achievements: PlayerAchievement[] }) {
  if (achievements.length === 0) return null;

  return (
    <div className="scoreboard-player__achievements">
      {achievements.map((achievement) => (
        <span className={`scoreboard-player__achievement scoreboard-player__achievement--${achievement}`} key={achievement} title={PLAYER_ACHIEVEMENTS[achievement].title}>
          {PLAYER_ACHIEVEMENTS[achievement].label}
        </span>
      ))}
    </div>
  );
}

function ScoreboardInventory({
  itemIds,
  neutralItemId,
  permanentUpgradeItemIds,
}: {
  itemIds: number[];
  neutralItemId: number | null;
  permanentUpgradeItemIds: MatchDetailPlayer['permanentUpgradeItemIds'];
}) {
  const { t } = useTranslation();
  const slots = Array.from({ length: 6 }, (_, index) => itemIds[index] ?? null);

  return (
    <div className="scoreboard-table__inventory">
      <div className="scoreboard-table__inventory-items">
        {slots.map((itemId, index) => <ScoreboardItemSlot itemId={itemId} key={index} />)}
        {neutralItemId !== null ? <ScoreboardItemSlot itemId={neutralItemId} tone="neutral" /> : null}
      </div>
      <div className="scoreboard-table__permanent-upgrades" role="group" aria-label={t('scoreboardPermanentUpgradesAriaLabel')}>
        <ScoreboardPermanentUpgradeSlot kind="scepter" itemId={permanentUpgradeItemIds.scepterItemId} />
        <ScoreboardPermanentUpgradeSlot kind="shard" itemId={permanentUpgradeItemIds.shardItemId} />
        <ScoreboardPermanentUpgradeSlot kind="moonShard" itemId={permanentUpgradeItemIds.moonShardItemId} />
      </div>
    </div>
  );
}

function ScoreboardPermanentUpgradeSlot({
  kind,
  itemId,
}: {
  kind: 'scepter' | 'shard' | 'moonShard';
  itemId: number | null;
}) {
  const { t } = useTranslation();
  const upgradeLabel = t(
    kind === 'scepter'
      ? 'scoreboardAghanimScepterLabel'
      : kind === 'shard'
        ? 'scoreboardAghanimShardLabel'
        : 'scoreboardMoonShardLabel',
  );
  const item = itemId === null ? null : getItemIcon(itemId);
  const itemLabel = item?.label ?? (itemId === null ? null : `Item #${itemId}`);
  const isEmpty = itemId === null;
  const tooltip = isEmpty
    ? t('scoreboardPermanentUpgradeEmptyTooltip', { upgrade: upgradeLabel })
    : t('scoreboardPermanentUpgradeTooltip', { upgrade: upgradeLabel });
  const ariaLabel = isEmpty
    ? t('scoreboardPermanentUpgradeEmptyAriaLabel', { upgrade: upgradeLabel })
    : t('scoreboardPermanentUpgradeAriaLabel', { upgrade: upgradeLabel, item: itemLabel ?? '' });

  return (
    <Tooltip content={tooltip} ariaLabel={ariaLabel}>
      <span className={`scoreboard-table__item scoreboard-table__permanent-upgrade${isEmpty ? ' is-empty' : ''}`}>
        {item ? <img src={item.src} alt={item.label} /> : isEmpty ? <span className="scoreboard-table__permanent-placeholder" aria-hidden="true">{kind === 'scepter' ? 'S' : kind === 'shard' ? 'SH' : 'M'}</span> : <strong>#{itemId}</strong>}
      </span>
    </Tooltip>
  );
}

function ScoreboardItemSlot({ itemId, tone }: { itemId: number | null; tone?: 'neutral' }) {
  const item = itemId === null ? null : getItemIcon(itemId);

  return (
    <span className={`scoreboard-table__item${tone ? ` is-${tone}` : ''}`} title={item?.label ?? (itemId === null ? undefined : `Item #${itemId}`)}>
      {item ? <img src={item.src} alt={item.label} /> : itemId === null ? null : <strong>#{itemId}</strong>}
    </span>
  );
}

function ScoreboardHeroMark({ heroId, heroNames }: { heroId: number | null; heroNames: Record<number, string> }) {
  const label = heroLabel(heroId, heroNames);
  return <HeroMark heroId={heroId} label={label} fallback={heroMark(heroId, heroNames)} className="scoreboard-player__hero" />;
}

function ScoreboardHeroWithPosition({
  heroId,
  heroNames,
  position,
  role,
}: {
  heroId: number | null;
  heroNames: Record<number, string>;
  position: MatchDetailPlayer['position'];
  role: MatchDetailPlayer['role'];
}) {
  const positionIcon = position === null ? null : getPositionIcon(position);
  const positionLabel = role === null ? positionIcon?.label : formatEnum(role);

  return (
    <span className="scoreboard-player__hero-with-position">
      <ScoreboardHeroMark heroId={heroId} heroNames={heroNames} />
      {positionIcon && positionLabel ? (
        <Tooltip content={positionLabel}>
          <img className="scoreboard-player__position" src={positionIcon.src} alt={positionLabel} />
        </Tooltip>
      ) : null}
    </span>
  );
}

function scoreboardPlayerClass(player: MatchDetailPlayer, performanceRank: PerformanceRank | undefined, currentAccountId: number | null): string {
  const rankClass = performanceRank === 1 ? ' is-highest' : performanceRank === 2 ? ' is-second' : '';
  const currentClass = currentAccountId !== null && player.accountId === currentAccountId ? ' is-current' : '';
  return `scoreboard-player ${player.isRadiant ? 'is-radiant' : 'is-dire'}${rankClass}${currentClass}`;
}

function scoreboardTableRowClass(player: MatchDetailPlayer, performanceRank: PerformanceRank | undefined, currentAccountId: number | null): string {
  const rankClass = performanceRank === 1 ? ' is-highest' : performanceRank === 2 ? ' is-second' : '';
  const currentClass = currentAccountId !== null && player.accountId === currentAccountId ? ' is-current' : '';
  return `scoreboard-table__row ${player.isRadiant ? 'is-radiant' : 'is-dire'}${rankClass}${currentClass}`;
}

function formatImp(value: number | null): string {
  if (value === null) return 'N/A';
  return value > 0 ? `+${value}` : String(value);
}

function getScoreboardRecords(players: MatchDetailPlayer[]): ScoreboardRecords {
  const records: ScoreboardRecords = {};

  for (const { metric, direction } of SCOREBOARD_RECORD_METRICS) {
    const values = [...new Set(players.flatMap((player) => {
      const value = player[metric];
      return value === null ? [] : [value];
    }))];
    if (values.length === 0) continue;

    const record = direction === 'highest' ? Math.max(...values) : Math.min(...values);
    if (direction === 'highest' && record <= 0) continue;

    records[metric] = record;
  }

  return records;
}

function isScoreboardRecord(records: ScoreboardRecords, metric: ScoreboardRecordMetric, value: number | null): boolean {
  return value !== null && records[metric] === value;
}

function SplitRosterIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 2.5h5v4h-5zm8 0h5v4h-5zm-8 7h5v4h-5zm8 0h5v4h-5z" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 2.5h12v11H2zM2 6.2h12M5.7 2.5v11M9.8 2.5v11" />
    </svg>
  );
}

function rankPlayersByImp(players: MatchDetailPlayer[]): Map<string, PerformanceRank> {
  const impValues = [...new Set(players.flatMap((player) => player.imp === null ? [] : [player.imp]))]
    .sort((left, right) => right - left);
  const highest = impValues[0];
  const second = impValues[1];
  const ranks = new Map<string, PerformanceRank>();

  for (const player of players) {
    if (player.imp === highest) {
      ranks.set(player.key, 1);
    } else if (player.imp === second) {
      ranks.set(player.key, 2);
    }
  }

  return ranks;
}

function getPlayerAchievements(
  players: MatchDetailPlayer[],
  performanceRanks: Map<string, PerformanceRank>,
): Map<string, PlayerAchievement[]> {
  const highestHeroDamage = highestPlayerMetric(players, (player) => player.heroDamage);
  const highestTowerDamage = highestPlayerMetric(players, (player) => player.towerDamage);
  const achievements = new Map<string, PlayerAchievement[]>();

  for (const player of players) {
    const playerAchievements: PlayerAchievement[] = [];
    const performanceRank = performanceRanks.get(player.key);
    if (performanceRank === 1) {
      playerAchievements.push('mvp');
    } else if (performanceRank === 2) {
      playerAchievements.push('top-imp');
    }
    if (highestHeroDamage > 0 && player.heroDamage === highestHeroDamage) {
      playerAchievements.push('most-damage');
    }
    if (highestTowerDamage > 0 && player.towerDamage === highestTowerDamage) {
      playerAchievements.push('most-tower-damage');
    }
    if (playerAchievements.length > 0) {
      achievements.set(player.key, playerAchievements);
    }
  }

  return achievements;
}

function highestPlayerMetric(players: MatchDetailPlayer[], getValue: (player: MatchDetailPlayer) => number): number {
  return topPlayerMetricValues(players, getValue)[0] ?? 0;
}

function topPlayerMetricValues(players: MatchDetailPlayer[], getValue: (player: MatchDetailPlayer) => number): number[] {
  return [...new Set(players.map(getValue))].sort((left, right) => right - left);
}
