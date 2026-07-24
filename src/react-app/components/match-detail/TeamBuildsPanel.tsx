import { useState, useRef, type ReactNode } from 'react';
import type { MatchDetailPlayer, MatchDetailSnapshot } from '../../lib/match-detail';
import { getAbilityIcon } from '../../lib/ability-icons';
import { getItemIcon } from '../../lib/item-icons';
import { itemIconSlugs } from '../../lib/item-icon-slugs';
import { getPositionIcon } from '../../lib/position-icons';
import { useTranslation } from '../../lib/i18n';
import { talentDescriptions } from '../../lib/talent-descriptions';
import { HeroPortrait } from '../HeroPortrait';
import { PlayerSortControls, type PlayerSort } from '../PlayerSortControls';
import { Tooltip } from '../Tooltip';
import { formatAccount, formatCompact, formatEventTime, heroLabel, heroMark } from './match-detail-display';
import { sortPlayers } from './match-detail-player';
import { DetailHeading } from './match-detail-primitives';
import { PermanentUpgradeSlot } from './PermanentUpgradeSlot';

const CONSUMABLE_ITEM_SLUGS = new Set([
  'tpscroll',
  'clarity',
  'flask',
  'tango',
  'tango_single',
  'enchanted_mango',
  'greater_mango',
  'faerie_fire',
  'greater_faerie_fire',
  'bottle',
  'famango',
  'great_famango',
  'greater_famango',
  'blood_grenade',
  'dust',
  'ward_observer',
  'ward_sentry',
  'ward_dispenser',
  'smoke_of_deceit',
  'tome_of_knowledge',
  'cheese',
  'refresher_shard',
]);

function isConsumableItem(itemId: number): boolean {
  const slug = itemIconSlugs[itemId];
  return slug ? CONSUMABLE_ITEM_SLUGS.has(slug) : false;
}

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
          <div className="build-team__faction-tag">
            <span className="build-team__faction-dot" aria-hidden="true" />
            <span className="micro-label">Faction Loadout</span>
          </div>
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
  type AbilityFilterMode = 'all' | 'skills' | 'talents';
  type PurchaseFilterMode = 'all' | 'core' | 'consumables';
  const [abilityFilter, setAbilityFilter] = useState<AbilityFilterMode>('all');
  const [purchaseFilter, setPurchaseFilter] = useState<PurchaseFilterMode>('all');
  const teamClass = player.isRadiant ? 'player-build--radiant' : 'player-build--dire';
  const impVal = player.imp;
  const impClass = impVal === null ? 'is-neutral' : impVal > 0 ? 'is-positive' : 'is-negative';
  const impText = impVal === null ? '— IMP' : `${impVal > 0 ? '+' : ''}${impVal} IMP`;
  const positionIcon = player.position === null ? null : getPositionIcon(player.position);

  const abilityEvents = abilityFilter === 'skills'
    ? player.abilityBuild.filter((a) => !a.isTalent)
    : abilityFilter === 'talents'
    ? player.abilityBuild.filter((a) => a.isTalent)
    : player.abilityBuild;

  const purchaseEvents = purchaseFilter === 'core'
    ? player.purchaseEvents.filter((p) => !isConsumableItem(p.itemId))
    : purchaseFilter === 'consumables'
    ? player.purchaseEvents.filter((p) => isConsumableItem(p.itemId))
    : player.purchaseEvents;

  return (
    <article
      className={`player-build ${teamClass}${highlighted ? ' is-current' : ''}`}
      aria-current={highlighted ? 'true' : undefined}
      aria-label={`Build for ${player.name ?? formatAccount(player.accountId)}`}
    >
      <div className="player-build__header">
        <TeamBuildHeroPortrait heroId={player.heroId} heroNames={heroNames} />
        <div className="player-build__identity">
          <strong className="player-build__name">{player.name ?? formatAccount(player.accountId)}</strong>
          <div className="player-build__hero-meta">
            {positionIcon ? (
              <Tooltip content={positionIcon.label} focusable={false}>
                <img className="player-build__position-icon" src={positionIcon.src} alt={positionIcon.label} />
              </Tooltip>
            ) : null}
            <span className="player-build__hero-name">{heroLabel(player.heroId, heroNames)}</span>
            <span className="player-build__level-badge">
              <small>LVL</small> <strong>{player.level}</strong>
            </span>
          </div>
        </div>
        <span className={`player-build__imp-badge ${impClass}`}>
          {impText}
        </span>
      </div>
      <PlayerBuildSection label="FINAL BUILD" className="player-build__loadout" ariaLabel={`Final loadout for ${player.name ?? formatAccount(player.accountId)}`}>
        <div className="player-build__items">
          {player.itemIds.length === 0 ? <span className="item-token is-empty">NO ITEMS</span> : null}
          {player.itemIds.map((itemId, index) => <ItemToken itemId={itemId} key={`${itemId}-${index}`} />)}
          {player.backpackItemIds.map((itemId, index) => <ItemToken itemId={itemId} tone="backpack" key={`b-${itemId}-${index}`} />)}
          {player.neutralItemId ? <ItemToken itemId={player.neutralItemId} tone="neutral" /> : null}
          <PlayerBuildPermanentUpgrades permanentUpgradeItemIds={player.permanentUpgradeItemIds} />
        </div>
      </PlayerBuildSection>
      <BuildTimeline
        label="ABILITIES"
        emptyLabel="No ability events"
        unavailableLabel="Ability progression unavailable."
        available={player.hasAbilityBuildData}
        events={abilityEvents}
        extraHeaderControl={
          <div className="build-timeline__filter-group" role="group" aria-label="Ability filter">
            <button
              type="button"
              className={`build-timeline__filter-btn${abilityFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => setAbilityFilter('all')}
            >
              ALL
            </button>
            <button
              type="button"
              className={`build-timeline__filter-btn${abilityFilter === 'skills' ? ' is-active' : ''}`}
              onClick={() => setAbilityFilter('skills')}
            >
              SKILLS
            </button>
            <button
              type="button"
              className={`build-timeline__filter-btn${abilityFilter === 'talents' ? ' is-active' : ''}`}
              onClick={() => setAbilityFilter('talents')}
            >
              TALENTS
            </button>
          </div>
        }
      >
        {(ability, index) => <AbilityToken ability={ability} key={`${ability.time}-${ability.abilityId}-${index}`} />}
      </BuildTimeline>
      <BuildTimeline
        label="PURCHASES"
        emptyLabel="No purchase events"
        unavailableLabel="Purchase progression unavailable."
        available={player.hasPurchaseEventsData}
        events={purchaseEvents}
        extraHeaderControl={
          <div className="build-timeline__filter-group" role="group" aria-label="Purchase filter">
            <button
              type="button"
              className={`build-timeline__filter-btn${purchaseFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => setPurchaseFilter('all')}
            >
              ALL
            </button>
            <button
              type="button"
              className={`build-timeline__filter-btn${purchaseFilter === 'core' ? ' is-active' : ''}`}
              onClick={() => setPurchaseFilter('core')}
            >
              CORE
            </button>
            <button
              type="button"
              className={`build-timeline__filter-btn${purchaseFilter === 'consumables' ? ' is-active' : ''}`}
              onClick={() => setPurchaseFilter('consumables')}
            >
              SUPPLIES
            </button>
          </div>
        }
      >
        {(purchase, index) => <PurchaseToken purchase={purchase} key={`${purchase.time}-${purchase.itemId}-${index}`} />}
      </BuildTimeline>
      <div className="player-build__footer">
        <div className={`player-build__metric${
          player.heroDamage > 0 && player.heroDamage === maxStats.first.heroDamage ? ' is-highest' :
          player.heroDamage > 0 && player.heroDamage === maxStats.second.heroDamage ? ' is-second' : ''
        }`}>
          <span className="player-build__metric-label">Hero DMG</span>
          <span className="player-build__metric-value">{formatCompact(player.heroDamage)}</span>
        </div>
        <div className={`player-build__metric${
          player.towerDamage > 0 && player.towerDamage === maxStats.first.towerDamage ? ' is-highest' :
          player.towerDamage > 0 && player.towerDamage === maxStats.second.towerDamage ? ' is-second' : ''
        }`}>
          <span className="player-build__metric-label">Tower DMG</span>
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

function PlayerBuildSection({
  label,
  count,
  className,
  ariaLabel,
  children,
}: {
  label: string;
  count?: number;
  className: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className={`player-build__section ${className}`} aria-label={ariaLabel}>
      <div className="player-build__section-header">
        <span className="player-build__label">{label}</span>
        {count === undefined ? null : <span className="build-timeline__count">{count}</span>}
      </div>
      {children}
    </div>
  );
}

function BuildTimeline<T extends { time: number }>({
  label,
  emptyLabel,
  unavailableLabel,
  available,
  events,
  extraHeaderControl,
  children,
}: {
  label: string;
  emptyLabel: string;
  unavailableLabel: string;
  available: boolean;
  events: T[];
  extraHeaderControl?: ReactNode;
  children: (event: T, index: number) => ReactNode;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const holdTimeoutRef = useRef<number | null>(null);

  const scrollStep = (direction: 'left' | 'right') => {
    if (!stripRef.current) return;
    stripRef.current.scrollBy({
      left: direction === 'left' ? -160 : 160,
      behavior: 'smooth',
    });
  };

  const startContinuousScroll = (direction: 'left' | 'right') => {
    stopContinuousScroll();
    scrollStep(direction);

    holdTimeoutRef.current = window.setTimeout(() => {
      const step = () => {
        if (stripRef.current) {
          stripRef.current.scrollLeft += direction === 'left' ? -3.5 : 3.5;
        }
        animFrameRef.current = requestAnimationFrame(step);
      };
      animFrameRef.current = requestAnimationFrame(step);
    }, 220);
  };

  const stopContinuousScroll = () => {
    if (holdTimeoutRef.current !== null) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  return (
    <div className="player-build__section build-timeline">
      <div className="player-build__section-header">
        <div className="build-timeline__header-title">
          <span className="player-build__label">{label}</span>
          <span className="build-timeline__count">{events.length}</span>
          {extraHeaderControl}
        </div>
        {available && events.length > 0 ? (
          <div className="build-timeline__scroll-controls">
            <button
              type="button"
              className="build-timeline__scroll-btn"
              onPointerDown={() => startContinuousScroll('left')}
              onPointerUp={stopContinuousScroll}
              onPointerLeave={stopContinuousScroll}
              onPointerCancel={stopContinuousScroll}
              aria-label={`Scroll ${label} left`}
            >
              ‹
            </button>
            <button
              type="button"
              className="build-timeline__scroll-btn"
              onPointerDown={() => startContinuousScroll('right')}
              onPointerUp={stopContinuousScroll}
              onPointerLeave={stopContinuousScroll}
              onPointerCancel={stopContinuousScroll}
              aria-label={`Scroll ${label} right`}
            >
              ›
            </button>
          </div>
        ) : null}
      </div>
      {!available ? (
        <span className="build-timeline__empty">{unavailableLabel}</span>
      ) : events.length === 0 ? (
        <span className="build-timeline__empty">{emptyLabel}</span>
      ) : (
        <div className="build-timeline__strip" ref={stripRef}>
          {events.map(children)}
        </div>
      )}
    </div>
  );
}

function ItemToken({ itemId, tone }: { itemId: number; tone?: 'backpack' | 'neutral' }) {
  const item = getItemIcon(itemId);
  const label = item?.label ?? `Item #${itemId}`;

  return (
    <Tooltip content={label} ariaLabel={label}>
      <span className={`item-token${tone ? ` is-${tone}` : ''}`}>
        {item ? <img className="item-token__icon" src={item.src} alt={item.label} /> : `#${itemId}`}
      </span>
    </Tooltip>
  );
}

function PlayerBuildPermanentUpgrades({
  permanentUpgradeItemIds,
}: {
  permanentUpgradeItemIds: MatchDetailPlayer['permanentUpgradeItemIds'];
}) {
  const { t } = useTranslation();

  return (
    <div className="player-build__permanent-upgrades" role="group" aria-label={t('scoreboardPermanentUpgradesAriaLabel')}>
      <PermanentUpgradeSlot kind="scepter" itemId={permanentUpgradeItemIds.scepterItemId} slotClassName="item-token player-build__permanent-upgrade" placeholderClassName="player-build__permanent-placeholder" itemIconClassName="item-token__icon" />
      <PermanentUpgradeSlot kind="shard" itemId={permanentUpgradeItemIds.shardItemId} slotClassName="item-token player-build__permanent-upgrade" placeholderClassName="player-build__permanent-placeholder" itemIconClassName="item-token__icon" />
      <PermanentUpgradeSlot kind="moonShard" itemId={permanentUpgradeItemIds.moonShardItemId} slotClassName="item-token player-build__permanent-upgrade" placeholderClassName="player-build__permanent-placeholder" itemIconClassName="item-token__icon" />
    </div>
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
    <Tooltip content={`${label} · ${timing}`} focusable={false}>
      <span className={`build-timeline__token${ability.isTalent ? ' is-talent' : ' build-timeline__token--ability'}`} role="img" aria-label={`${label}, ${timing}`}>
        {ability.isTalent ? (
          <>
            <span className="build-timeline__talent-mark" aria-hidden="true">T</span>
            <strong className="build-timeline__talent-description">{talentDescription ?? 'Talent'}</strong>
          </>
        ) : abilityIcon ? <img className="build-timeline__ability-icon" src={abilityIcon.src} alt="" /> : <strong>{label}</strong>}
        {!ability.isTalent ? <span className="build-timeline__ability-level" aria-hidden="true">{ability.level + 1}</span> : null}
        <small>{formatEventTime(ability.time)}</small>
      </span>
    </Tooltip>
  );
}

function PurchaseToken({ purchase }: { purchase: MatchDetailPlayer['purchaseEvents'][number] }) {
  const item = getItemIcon(purchase.itemId);
  const label = item?.label ?? `Item #${purchase.itemId}`;
  const time = formatEventTime(purchase.time);

  return (
    <Tooltip content={`${label} · ${time}`} focusable={false}>
      <span className="build-timeline__token build-timeline__token--item" role="img" aria-label={`${label}, ${time}`}>
        {item ? <img className="build-timeline__item-icon" src={item.src} alt={item.label} /> : <strong>#{purchase.itemId}</strong>}
        <small>{time}</small>
      </span>
    </Tooltip>
  );
}

function formatAbilityName(name: string | null, abilityId: number): string {
  if (!name) return `Ability #${abilityId}`;
  const readable = name.includes('_') ? name.split('_').slice(1).join(' ') : name;
  return readable.replace(/^./, (letter) => letter.toUpperCase());
}
