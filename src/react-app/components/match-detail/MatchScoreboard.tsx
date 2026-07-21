import { useState } from 'react';
import type { MatchDetailPlayer } from '../../lib/match-detail';
import { getItemIcon } from '../../lib/item-icons';
import { HeroMark } from '../HeroMark';
import { PlayerSortControls, type PlayerSort } from '../PlayerSortControls';
import { formatAccount, formatCompact, formatEnum, heroLabel, heroMark } from './match-detail-display';
import { sortPlayers } from './match-detail-player';
import { DetailHeading } from './match-detail-primitives';

type PerformanceRank = 1 | 2;
type PlayerAchievement = 'mvp' | 'top-imp' | 'most-damage' | 'most-tower-damage';
type ScoreboardView = 'roster' | 'table';

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
  const [view, setView] = useState<ScoreboardView>('roster');
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
            <ScoreboardHeroMark heroId={player.heroId} heroNames={heroNames} />
            <div className="scoreboard-player__identity">
              <strong>{playerLabel}</strong>
              <span>{heroLabel(player.heroId, heroNames)} · {formatEnum(player.role ?? 'UNKNOWN')}</span>
              <AchievementBadges achievements={achievements} />
            </div>
            <div className="scoreboard-player__kda" role="group" aria-label={`${player.kills} kills, ${player.deaths} deaths, ${player.assists} assists`}>
              <span><small>K</small><strong>{player.kills}</strong></span>
              <span><small>D</small><strong>{player.deaths}</strong></span>
              <span><small>A</small><strong>{player.assists}</strong></span>
            </div>
            <div className="scoreboard-player__economy">
              <span><small>GPM</small><strong>{player.goldPerMinute}</strong></span>
              <span><small>XPM</small><strong>{player.xpPerMinute}</strong></span>
            </div>
            <span className="scoreboard-player__net"><small>NW</small><strong>{formatCompact(player.netWorth)}</strong></span>
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
}: {
  radiantPlayers: MatchDetailPlayer[];
  direPlayers: MatchDetailPlayer[];
  heroNames: Record<number, string>;
  currentAccountId: number | null;
  sort: PlayerSort;
  performanceRanks: Map<string, PerformanceRank>;
  playerAchievements: Map<string, PlayerAchievement[]>;
}) {
  const orderedRadiantPlayers = sortPlayers(radiantPlayers, sort);
  const orderedDirePlayers = sortPlayers(direPlayers, sort);

  return (
    <div className="scoreboard-table-scroll">
      <table className="scoreboard-table" aria-label="Ten-player scoreboard table">
        <thead>
          <tr>
            <th scope="col">Hero</th>
            <th scope="col">Player</th>
            <th scope="col">K / D / A</th>
            <th scope="col">NW</th>
            <th scope="col">IMP</th>
            <th scope="col">LH / DN</th>
            <th scope="col">GPM / XPM</th>
            <th scope="col">HD</th>
            <th scope="col">TD</th>
            <th scope="col">HH</th>
            <th scope="col">Inventory</th>
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
              key={player.key}
            />
          ))}
        </tbody>
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
}: {
  player: MatchDetailPlayer;
  heroNames: Record<number, string>;
  currentAccountId: number | null;
  performanceRank: PerformanceRank | undefined;
  achievements: PlayerAchievement[];
}) {
  const playerLabel = player.name ?? formatAccount(player.accountId);

  return (
    <tr className={scoreboardTableRowClass(player, performanceRank, currentAccountId)} aria-label={`Scoreboard row for ${playerLabel}`}>
      <td className="scoreboard-table__hero-cell">
        <ScoreboardHeroMark heroId={player.heroId} heroNames={heroNames} />
      </td>
      <th className="scoreboard-table__player" scope="row">
        <span className="scoreboard-table__player-content">
          <span className="scoreboard-table__level">{player.level}</span>
          <span className="scoreboard-table__player-copy">
            <strong>{playerLabel}</strong>
            <small>{heroLabel(player.heroId, heroNames)} · {formatEnum(player.role ?? 'UNKNOWN')}</small>
            <AchievementBadges achievements={achievements} />
          </span>
        </span>
      </th>
      <td className="scoreboard-table__numeric" aria-label={`${player.kills} kills, ${player.deaths} deaths, ${player.assists} assists`}>
        {player.kills} / {player.deaths} / {player.assists}
      </td>
      <td className="scoreboard-table__numeric">{formatCompact(player.netWorth)}</td>
      <td className={`scoreboard-table__numeric scoreboard-table__imp${player.imp === null ? ' is-unavailable' : player.imp > 0 ? ' is-positive' : player.imp < 0 ? ' is-negative' : ''}`}>
        {formatImp(player.imp)}
      </td>
      <td className="scoreboard-table__numeric">{player.lastHits} / {player.denies}</td>
      <td className="scoreboard-table__numeric">{formatCompact(player.goldPerMinute)} / {formatCompact(player.xpPerMinute)}</td>
      <td className="scoreboard-table__numeric">{formatCompact(player.heroDamage)}</td>
      <td className="scoreboard-table__numeric">{formatCompact(player.towerDamage)}</td>
      <td className="scoreboard-table__numeric">{formatCompact(player.heroHealing)}</td>
      <td><ScoreboardInventory itemIds={player.itemIds} neutralItemId={player.neutralItemId} /></td>
    </tr>
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

function ScoreboardInventory({ itemIds, neutralItemId }: { itemIds: number[]; neutralItemId: number | null }) {
  const slots = Array.from({ length: 6 }, (_, index) => itemIds[index] ?? null);

  return (
    <div className="scoreboard-table__inventory">
      {slots.map((itemId, index) => <ScoreboardItemSlot itemId={itemId} key={index} />)}
      {neutralItemId !== null ? <ScoreboardItemSlot itemId={neutralItemId} tone="neutral" /> : null}
    </div>
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
