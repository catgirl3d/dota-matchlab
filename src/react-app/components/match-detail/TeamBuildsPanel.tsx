import { useState, type ReactNode } from 'react';
import type { MatchDetailPlayer, MatchDetailSnapshot } from '../../lib/match-detail';
import { getAbilityIcon } from '../../lib/ability-icons';
import { getItemIcon } from '../../lib/item-icons';
import { talentDescriptions } from '../../lib/talent-descriptions';
import { HeroPortrait } from '../HeroPortrait';
import { PlayerSortControls, type PlayerSort } from '../PlayerSortControls';
import { formatAccount, formatCompact, formatEventTime, heroLabel, heroMark } from './match-detail-display';
import { sortPlayers } from './match-detail-player';
import { DetailHeading } from './match-detail-primitives';

type BuildMetricRanks = {
  first: {
    heroDamage: number;
    towerDamage: number;
    cs: number;
    skills: number;
  };
  second: {
    heroDamage: number;
    towerDamage: number;
    cs: number;
    skills: number;
  };
};

type TeamBuildsPanelProps = {
  players: MatchDetailPlayer[];
  heroNames: Record<number, string>;
  currentAccountId: number | null;
  rosterStatus: MatchDetailSnapshot['rosterStatus'];
};

export function TeamBuildsPanel({
  players,
  heroNames,
  currentAccountId,
  rosterStatus,
}: TeamBuildsPanelProps) {
  const [sort, setSort] = useState<PlayerSort>('slot');
  const radiantPlayers = players.filter((player) => player.isRadiant);
  const direPlayers = players.filter((player) => !player.isRadiant);
  const maxStats = getBuildMetricRanks(players);

  return (
    <section className="detail-panel detail-builds" aria-labelledby="builds-title">
      <div className="detail-builds__header">
        <DetailHeading eyebrow="LOADOUT / BUILDS" title="Team builds" id="builds-title" />
        <PlayerSortControls value={sort} onChange={setSort} ariaLabel="Sort team builds" />
      </div>
      {rosterStatus === 'incomplete' ? (
        <p className="detail-builds__roster-status">{players.length}/10 players captured</p>
      ) : null}
      <div className="detail-builds__grid">
        <BuildTeamColumn
          side="radiant"
          players={radiantPlayers}
          heroNames={heroNames}
          currentAccountId={currentAccountId}
          maxStats={maxStats}
          sort={sort}
        />
        <BuildTeamColumn
          side="dire"
          players={direPlayers}
          heroNames={heroNames}
          currentAccountId={currentAccountId}
          maxStats={maxStats}
          sort={sort}
        />
      </div>
    </section>
  );
}

function getBuildMetricRanks(players: MatchDetailPlayer[]): BuildMetricRanks {
  const heroDamages = topPlayerMetricValues(players, (player) => player.heroDamage);
  const towerDamages = topPlayerMetricValues(players, (player) => player.towerDamage);
  const csValues = topPlayerMetricValues(players, (player) => player.lastHits);
  const skillsValues = topPlayerMetricValues(players, (player) => player.abilityBuild.length);

  return {
    first: {
      heroDamage: heroDamages[0] ?? 0,
      towerDamage: towerDamages[0] ?? 0,
      cs: csValues[0] ?? 0,
      skills: skillsValues[0] ?? 0,
    },
    second: {
      heroDamage: heroDamages[1] ?? 0,
      towerDamage: towerDamages[1] ?? 0,
      cs: csValues[1] ?? 0,
      skills: skillsValues[1] ?? 0,
    },
  };
}

function topPlayerMetricValues(players: MatchDetailPlayer[], getValue: (player: MatchDetailPlayer) => number): number[] {
  return [...new Set(players.map(getValue))].sort((left, right) => right - left);
}

function BuildTeamColumn({
  side,
  players,
  heroNames,
  currentAccountId,
  maxStats,
  sort,
}: {
  side: 'radiant' | 'dire';
  players: MatchDetailPlayer[];
  heroNames: Record<number, string>;
  currentAccountId: number | null;
  maxStats: BuildMetricRanks;
  sort: PlayerSort;
}) {
  const orderedPlayers = sortPlayers(players, sort);
  return (
    <section className={`build-team build-team--${side}`} aria-labelledby={`build-team-${side}`}>
      <header className="build-team__header">
        <div className="build-team__header-title">
          <span className="micro-label">
            {side === 'radiant' ? 'Radiant Faction' : 'Dire Faction'}
          </span>
          <h4 id={`build-team-${side}`}>{side === 'radiant' ? 'Radiant builds' : 'Dire builds'}</h4>
        </div>
        <div className="build-team__badge">
          <span className="build-team__badge-count">{orderedPlayers.length}</span>
          <span className="build-team__badge-label">Players</span>
        </div>
      </header>
      {orderedPlayers.length === 0 ? (
        <p className="build-team__empty">Roster is incomplete. No {side} player data was stored.</p>
      ) : orderedPlayers.map((player) => (
        <PlayerBuild
          key={player.key}
          player={player}
          heroNames={heroNames}
          highlighted={currentAccountId !== null && player.accountId === currentAccountId}
          maxStats={maxStats}
        />
      ))}
    </section>
  );
}

function PlayerBuild({
  player,
  heroNames,
  highlighted,
  maxStats,
}: {
  player: MatchDetailPlayer;
  heroNames: Record<number, string>;
  highlighted: boolean;
  maxStats: BuildMetricRanks;
}) {
  const teamClass = player.isRadiant ? 'player-build--radiant' : 'player-build--dire';
  const impVal = player.imp;
  const impClass = impVal === null ? 'is-neutral' : impVal > 0 ? 'is-positive' : 'is-negative';
  const impText = impVal === null ? '— IMP' : `${impVal > 0 ? '+' : ''}${impVal} IMP`;

  return (
    <article
      className={`player-build ${teamClass}${highlighted ? ' is-current' : ''}`}
      aria-current={highlighted ? 'true' : undefined}
      aria-label={`Build for ${player.name ?? formatAccount(player.accountId)}`}
    >
      <div className="player-build__header">
        <TeamBuildHeroPortrait heroId={player.heroId} heroNames={heroNames} />
        <div>
          <strong>{player.name ?? formatAccount(player.accountId)}</strong>
          <span>{heroLabel(player.heroId, heroNames)} · {player.level} lvl</span>
        </div>
        <span className={`player-build__imp-badge ${impClass}`}>
          {impText}
        </span>
      </div>
      <div className="player-build__loadout" aria-label={`Final loadout for ${player.name ?? formatAccount(player.accountId)}`}>
        <span className="player-build__label">FINAL</span>
        <div className="player-build__items">
          {player.itemIds.length === 0 ? <span className="item-token is-empty">NO ITEMS</span> : null}
          {player.itemIds.map((itemId, index) => <ItemToken itemId={itemId} key={`${itemId}-${index}`} />)}
          {player.backpackItemIds.map((itemId, index) => <ItemToken itemId={itemId} tone="backpack" key={`b-${itemId}-${index}`} />)}
          {player.neutralItemId ? <ItemToken itemId={player.neutralItemId} tone="neutral" /> : null}
        </div>
      </div>
      <div className="player-build__progression">
        <BuildTimeline label="ABILITIES" emptyLabel="No ability events" unavailableLabel="Ability progression unavailable." available={player.hasAbilityBuildData} events={player.abilityBuild} total={player.abilityBuild.length}>
          {(ability, index) => <AbilityToken ability={ability} key={`${ability.time}-${ability.abilityId}-${index}`} />}
        </BuildTimeline>
        <BuildTimeline label="PURCHASES" emptyLabel="No purchase events" unavailableLabel="Purchase progression unavailable." available={player.hasPurchaseEventsData} events={player.purchaseEvents} total={player.purchaseEvents.length}>
          {(purchase, index) => (
            <span className="build-timeline__token build-timeline__token--item" key={`${purchase.time}-${purchase.itemId}-${index}`} title={`Item #${purchase.itemId} at ${formatEventTime(purchase.time)}`}>
              <ItemIcon itemId={purchase.itemId} className="build-timeline__item-icon" />
              {getItemIcon(purchase.itemId) === null ? <strong>#{purchase.itemId}</strong> : null}
              <small>{formatEventTime(purchase.time)}</small>
            </span>
          )}
        </BuildTimeline>
      </div>
      <div className="player-build__footer">
        <div className={`player-build__metric${
          player.heroDamage > 0 && player.heroDamage === maxStats.first.heroDamage ? ' is-highest' :
          player.heroDamage > 0 && player.heroDamage === maxStats.second.heroDamage ? ' is-second' : ''
        }`}>
          <span className="player-build__metric-label">Hero Dmg</span>
          <span className="player-build__metric-value">{formatCompact(player.heroDamage)}</span>
        </div>
        <div className={`player-build__metric${
          player.towerDamage > 0 && player.towerDamage === maxStats.first.towerDamage ? ' is-highest' :
          player.towerDamage > 0 && player.towerDamage === maxStats.second.towerDamage ? ' is-second' : ''
        }`}>
          <span className="player-build__metric-label">Tower Dmg</span>
          <span className="player-build__metric-value">{formatCompact(player.towerDamage)}</span>
        </div>
        <div className={`player-build__metric${
          player.lastHits > 0 && player.lastHits === maxStats.first.cs ? ' is-highest' :
          player.lastHits > 0 && player.lastHits === maxStats.second.cs ? ' is-second' : ''
        }`}>
          <span className="player-build__metric-label">CS</span>
          <span className="player-build__metric-value">{player.lastHits}/{player.denies}</span>
        </div>
        <div className={`player-build__metric${
          player.abilityBuild.length > 0 && player.abilityBuild.length === maxStats.first.skills ? ' is-highest' :
          player.abilityBuild.length > 0 && player.abilityBuild.length === maxStats.second.skills ? ' is-second' : ''
        }`}>
          <span className="player-build__metric-label">Skills</span>
          <span className="player-build__metric-value">{player.abilityBuild.length}</span>
        </div>
      </div>
    </article>
  );
}

function BuildTimeline<T extends { time: number }>({
  label,
  emptyLabel,
  unavailableLabel,
  available,
  events,
  total,
  children,
}: {
  label: string;
  emptyLabel: string;
  unavailableLabel: string;
  available: boolean;
  events: T[];
  total: number;
  children: (event: T, index: number) => ReactNode;
}) {
  return (
    <div className="build-timeline">
      <div className="build-timeline__header">
        <span className="player-build__label">{label}</span>
        <span className="build-timeline__count">{total}</span>
      </div>
      {!available ? <span className="build-timeline__empty">{unavailableLabel}</span> : events.length === 0 ? <span className="build-timeline__empty">{emptyLabel}</span> : <div className="build-timeline__strip">{events.map(children)}</div>}
    </div>
  );
}

function ItemToken({ itemId, tone }: { itemId: number; tone?: 'backpack' | 'neutral' }) {
  return (
    <span className={`item-token${tone ? ` is-${tone}` : ''}`}>
      <ItemIcon itemId={itemId} className="item-token__icon" />
      {getItemIcon(itemId) === null ? `#${itemId}` : null}
    </span>
  );
}

function TeamBuildHeroPortrait({ heroId, heroNames }: { heroId: number | null; heroNames: Record<number, string> }) {
  const label = heroLabel(heroId, heroNames);
  return <HeroPortrait heroId={heroId} label={label} fallback={heroMark(heroId, heroNames)} className="player-build__portrait" />;
}

function AbilityToken({ ability }: { ability: MatchDetailPlayer['abilityBuild'][number] }) {
  const abilityIcon = ability.isTalent ? null : getAbilityIcon(ability.name);
  const talentDescription = ability.isTalent ? talentDescriptions[ability.abilityId] : null;
  const label = ability.isTalent
    ? talentDescription ? `Talent: ${talentDescription}` : 'Talent'
    : abilityIcon ? formatAbilityName(ability.name, ability.abilityId) : `Ability #${ability.abilityId}`;
  const timing = ability.isTalent ? formatEventTime(ability.time) : `${formatEventTime(ability.time)} · level ${ability.level + 1}`;

  return (
    <span className={`build-timeline__token${ability.isTalent ? ' is-talent' : abilityIcon ? ' build-timeline__token--ability' : ''}`} role="img" aria-label={`${label}, ${timing}`} title={label}>
      {ability.isTalent ? (
        <>
          <span className="build-timeline__talent-mark" aria-hidden="true">T</span>
          <strong className="build-timeline__talent-description">{talentDescription ?? 'Talent'}</strong>
        </>
      ) : abilityIcon ? <img className="build-timeline__ability-icon" src={abilityIcon.src} alt="" /> : <strong>{label}</strong>}
      {!ability.isTalent ? <span className="build-timeline__ability-level" aria-hidden="true">{ability.level + 1}</span> : null}
      <small>{formatEventTime(ability.time)}</small>
    </span>
  );
}

function ItemIcon({ itemId, className }: { itemId: number; className: string }) {
  const item = getItemIcon(itemId);
  return item ? <img className={className} src={item.src} alt={item.label} title={item.label} /> : null;
}

function formatAbilityName(name: string | null, abilityId: number): string {
  if (!name) return `Ability #${abilityId}`;
  const readable = name.includes('_') ? name.split('_').slice(1).join(' ') : name;
  return readable.replace(/^./, (letter) => letter.toUpperCase());
}
