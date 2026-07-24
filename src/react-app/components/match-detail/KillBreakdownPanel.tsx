import { useState } from 'react';
import type { MatchDetailPlayer, MatchTimelineEvent } from '../../lib/match-detail';
import {
  buildKillBreakdown,
  buildKillKillerBreakdown,
  type KillBreakdownFight,
  type KillBreakdownKiller,
  type KillBreakdownPair,
} from '../../lib/kill-breakdown';
import { HeroMark } from '../HeroMark';
import { formatEventTime, heroLabel, heroMark } from './match-detail-display';
import { DetailHeading } from './match-detail-primitives';

type KillBreakdownPanelProps = {
  players: MatchDetailPlayer[];
  events: MatchTimelineEvent[];
  heroNames: Record<number, string>;
  isAvailable: boolean;
  selectedPlayerKey: string | null;
  onPlayerSelect: (playerKey: string) => void;
};

type KillBreakdownMode = 'fights' | 'full-match';

export function KillBreakdownPanel({
  players,
  events,
  heroNames,
  isAvailable,
  selectedPlayerKey,
  onPlayerSelect,
}: KillBreakdownPanelProps) {
  const [mode, setMode] = useState<KillBreakdownMode>('fights');
  const fights = buildKillBreakdown(players, events, selectedPlayerKey);
  const killers = buildKillKillerBreakdown(players, events, selectedPlayerKey);
  const isFightsMode = mode === 'fights';

  return (
    <section className="detail-panel detail-kill-breakdown" aria-labelledby="kill-breakdown-title">
      <div className="kill-breakdown__header">
        <DetailHeading eyebrow={isFightsMode ? 'KILLS / CONFIRMED FIGHTS' : 'KILLS / FULL MATCH'} title="Kill breakdown" id="kill-breakdown-title" />
        <div className="detail-segmented-control" role="group" aria-label="Kill breakdown mode">
          <KillBreakdownModeButton mode="fights" selectedMode={mode} onSelect={setMode}>Fights</KillBreakdownModeButton>
          <KillBreakdownModeButton mode="full-match" selectedMode={mode} onSelect={setMode}>Full match</KillBreakdownModeButton>
        </div>
      </div>
      {!isAvailable ? <p className="kill-breakdown__empty">Kill data is unavailable.</p> : isFightsMode && fights.length === 0 ? <p className="kill-breakdown__empty">No confirmed multi-hero fights.</p> : !isFightsMode && killers.length === 0 ? <p className="kill-breakdown__empty">No recorded hero kills.</p> : isFightsMode ? (
        <ol className="kill-breakdown__list">
          {fights.map((fight) => <KillBreakdownFightCard
            fight={fight}
            heroNames={heroNames}
            hasSelection={selectedPlayerKey !== null}
            onPlayerSelect={onPlayerSelect}
            key={fight.key}
          />)}
        </ol>
      ) : <div className="kill-breakdown__full-match">
        <KillKillerGroup team="radiant" killers={killers.filter((killer) => killer.killer.isRadiant)} heroNames={heroNames} hasSelection={selectedPlayerKey !== null} onPlayerSelect={onPlayerSelect} />
        <KillKillerGroup team="dire" killers={killers.filter((killer) => !killer.killer.isRadiant)} heroNames={heroNames} hasSelection={selectedPlayerKey !== null} onPlayerSelect={onPlayerSelect} />
      </div>}
    </section>
  );
}

function KillBreakdownModeButton({
  mode,
  selectedMode,
  onSelect,
  children,
}: {
  mode: KillBreakdownMode;
  selectedMode: KillBreakdownMode;
  onSelect: (mode: KillBreakdownMode) => void;
  children: string;
}) {
  return <button type="button" className={mode === selectedMode ? 'is-active' : ''} aria-pressed={mode === selectedMode} onClick={() => onSelect(mode)}>{children}</button>;
}

function KillBreakdownFightCard({
  fight,
  heroNames,
  hasSelection,
  onPlayerSelect,
}: {
  fight: KillBreakdownFight;
  heroNames: Record<number, string>;
  hasSelection: boolean;
  onPlayerSelect: (playerKey: string) => void;
}) {
  const timeRange = fight.startTime === fight.endTime
    ? formatEventTime(fight.startTime)
    : `${formatEventTime(fight.startTime)}-${formatEventTime(fight.endTime)}`;

  return (
    <li>
      <article className={`kill-breakdown__fight${fight.includesSelectedPlayer ? ' is-selected' : ''}${hasSelection && !fight.includesSelectedPlayer ? ' is-muted' : ''}`} aria-label={`Fight from ${timeRange}: ${fight.killCount} kills`}>
        <header className="kill-breakdown__fight-header">
          <time>{timeRange}</time>
          <div className="kill-breakdown__fight-score" aria-label={`Radiant ${fight.radiantKills}, Dire ${fight.direKills}`}>
            <TeamLabel team="radiant" /> <strong>{fight.radiantKills}</strong>
            <span aria-hidden="true">:</span>
            <strong>{fight.direKills}</strong> <TeamLabel team="dire" />
          </div>
        </header>
        <ol className="kill-breakdown__pairs">
          {fight.killPairs.map((pair) => <KillPairRow pair={pair} heroNames={heroNames} onPlayerSelect={onPlayerSelect} key={pair.key} />)}
        </ol>
      </article>
    </li>
  );
}

function KillPairRow({
  pair,
  heroNames,
  onPlayerSelect,
}: {
  pair: KillBreakdownPair;
  heroNames: Record<number, string>;
  onPlayerSelect: (playerKey: string) => void;
}) {
  const killerHero = heroLabel(pair.killer.heroId, heroNames);
  const victimHero = heroLabel(pair.victim.heroId, heroNames);
  return (
    <li aria-label={`${teamName(pair.killer)} ${killerHero} killed ${teamName(pair.victim)} ${victimHero}, ${pair.killCount} ${pair.killCount === 1 ? 'time' : 'times'}`}>
      <KillPlayer player={pair.killer} heroNames={heroNames} onPlayerSelect={onPlayerSelect} />
      <span className="kill-breakdown__arrow" aria-hidden="true">→</span>
      <KillPlayer player={pair.victim} heroNames={heroNames} onPlayerSelect={onPlayerSelect} />
      <strong>×{pair.killCount}</strong>
    </li>
  );
}

function KillKillerGroup({
  team,
  killers,
  heroNames,
  hasSelection,
  onPlayerSelect,
}: {
  team: Team;
  killers: KillBreakdownKiller[];
  heroNames: Record<number, string>;
  hasSelection: boolean;
  onPlayerSelect: (playerKey: string) => void;
}) {
  if (killers.length === 0) return null;

  return (
    <section className={`kill-breakdown__killer-group kill-breakdown__killer-group--${team}`} aria-label={`${teamName(team)} kills`}>
      <h4><TeamLabel team={team} /> kills</h4>
      <ol>
        {killers.map((killer) => <KillBreakdownKillerCard
          killer={killer}
          heroNames={heroNames}
          hasSelection={hasSelection}
          onPlayerSelect={onPlayerSelect}
          key={killer.key}
        />)}
      </ol>
    </section>
  );
}

function KillBreakdownKillerCard({
  killer,
  heroNames,
  hasSelection,
  onPlayerSelect,
}: {
  killer: KillBreakdownKiller;
  heroNames: Record<number, string>;
  hasSelection: boolean;
  onPlayerSelect: (playerKey: string) => void;
}) {
  const killerHero = heroLabel(killer.killer.heroId, heroNames);
  return (
    <li>
      <article className={`kill-breakdown__killer${killer.includesSelectedPlayer ? ' is-selected' : ''}${hasSelection && !killer.includesSelectedPlayer ? ' is-muted' : ''}`} aria-label={`${teamName(killer.killer)} ${killerHero} killed ${killer.totalKills} heroes`}>
        <KillerSource player={killer.killer} heroNames={heroNames} totalKills={killer.totalKills} onPlayerSelect={onPlayerSelect} />
        <span className="kill-breakdown__arrow" aria-hidden="true">→</span>
        <ol className="kill-breakdown__victims">
          {killer.victims.map((victim) => {
            const victimHero = heroLabel(victim.player.heroId, heroNames);
            return (
              <li aria-label={`${teamName(victim.player)} ${victimHero}, killed ${victim.killCount} ${victim.killCount === 1 ? 'time' : 'times'}`} key={victim.player.key}>
                <PlayerHeroButton player={victim.player} heroNames={heroNames} onPlayerSelect={onPlayerSelect} />
                <span>×{victim.killCount}</span>
              </li>
            );
          })}
        </ol>
      </article>
    </li>
  );
}

function KillerSource({
  player,
  heroNames,
  totalKills,
  onPlayerSelect,
}: {
  player: MatchDetailPlayer;
  heroNames: Record<number, string>;
  totalKills: number;
  onPlayerSelect: (playerKey: string) => void;
}) {
  const hero = heroLabel(player.heroId, heroNames);
  return (
    <div className={`kill-breakdown__killer-source kill-breakdown__killer-source--${player.isRadiant ? 'radiant' : 'dire'}`}>
      <PlayerHeroButton player={player} heroNames={heroNames} onPlayerSelect={onPlayerSelect} />
      <span><TeamLabel team={player.isRadiant ? 'radiant' : 'dire'} /><strong>{hero}</strong><small>{totalKills} {totalKills === 1 ? 'kill' : 'kills'}</small></span>
    </div>
  );
}

type Team = 'radiant' | 'dire';

function KillPlayer({
  player,
  heroNames,
  onPlayerSelect,
}: {
  player: MatchDetailPlayer;
  heroNames: Record<number, string>;
  onPlayerSelect: (playerKey: string) => void;
}) {
  const hero = heroLabel(player.heroId, heroNames);
  return (
    <div className={`kill-breakdown__player kill-breakdown__player--${player.isRadiant ? 'radiant' : 'dire'}`}>
      <PlayerHeroButton player={player} heroNames={heroNames} onPlayerSelect={onPlayerSelect} />
      <span><TeamLabel team={player.isRadiant ? 'radiant' : 'dire'} /><strong>{hero}</strong></span>
    </div>
  );
}

function TeamLabel({ team }: { team: Team }) {
  return <span className={`kill-breakdown__team-label kill-breakdown__team-label--${team}`}>{teamName(team)}</span>;
}

function teamName(playerOrTeam: MatchDetailPlayer | Team): string {
  const team = typeof playerOrTeam === 'string' ? playerOrTeam : playerOrTeam.isRadiant ? 'radiant' : 'dire';
  return team === 'radiant' ? 'Radiant' : 'Dire';
}


function PlayerHeroButton({
  player,
  heroNames,
  onPlayerSelect,
}: {
  player: MatchDetailPlayer;
  heroNames: Record<number, string>;
  onPlayerSelect: (playerKey: string) => void;
}) {
  const hero = heroLabel(player.heroId, heroNames);
  return (
    <button type="button" aria-label={`Filter by ${hero}`} onClick={() => onPlayerSelect(player.key)}>
      <HeroMark heroId={player.heroId} label={hero} fallback={heroMark(player.heroId, heroNames)} className="kill-breakdown__hero" />
    </button>
  );
}
