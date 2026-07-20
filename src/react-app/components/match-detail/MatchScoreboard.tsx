import { useState } from 'react';
import type { MatchDetailPlayer } from '../../lib/match-detail';
import { HeroMark } from '../HeroMark';
import { PlayerSortControls, type PlayerSort } from '../PlayerSortControls';
import { formatAccount, formatCompact, formatEnum, heroLabel, heroMark } from './match-detail-display';
import { sortPlayers } from './match-detail-player';
import { DetailHeading } from './match-detail-primitives';

type PerformanceRank = 1 | 2;
type PlayerAchievement = 'mvp' | 'top-imp' | 'most-damage' | 'most-tower-damage';

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
  const players = [...radiantPlayers, ...direPlayers];
  const performanceRanks = rankPlayersByImp(players);
  const playerAchievements = getPlayerAchievements(players, performanceRanks);

  return (
    <section className="detail-panel detail-scoreboard" aria-labelledby="scoreboard-title">
      <div className="detail-scoreboard__header">
        <DetailHeading eyebrow="MATCHUP / SCOREBOARD" title="Ten-player breakdown" id="scoreboard-title" />
        <PlayerSortControls value={sort} onChange={setSort} ariaLabel="Sort ten-player breakdown" />
      </div>
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
    </section>
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
        const rankClass = performanceRank === 1 ? ' is-highest' : performanceRank === 2 ? ' is-second' : '';
        const currentClass = currentAccountId !== null && player.accountId === currentAccountId ? ' is-current' : '';

        return (
          <article
            className={`scoreboard-player ${player.isRadiant ? 'is-radiant' : 'is-dire'}${rankClass}${currentClass}`}
            key={player.key}
            aria-label={`Scoreboard entry for ${playerLabel}`}
          >
            <ScoreboardHeroMark heroId={player.heroId} heroNames={heroNames} />
            <div className="scoreboard-player__identity">
              <strong>{playerLabel}</strong>
              <span>{heroLabel(player.heroId, heroNames)} · {formatEnum(player.role ?? 'UNKNOWN')}</span>
              {achievements.length > 0 ? (
                <div className="scoreboard-player__achievements">
                  {achievements.map((achievement) => (
                    <span className={`scoreboard-player__achievement scoreboard-player__achievement--${achievement}`} key={achievement} title={PLAYER_ACHIEVEMENTS[achievement].title}>
                      {PLAYER_ACHIEVEMENTS[achievement].label}
                    </span>
                  ))}
                </div>
              ) : null}
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

function ScoreboardHeroMark({ heroId, heroNames }: { heroId: number | null; heroNames: Record<number, string> }) {
  const label = heroLabel(heroId, heroNames);
  return <HeroMark heroId={heroId} label={label} fallback={heroMark(heroId, heroNames)} className="scoreboard-player__hero" />;
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
