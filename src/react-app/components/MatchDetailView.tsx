import { useState, type ReactNode } from 'react';
import direCrest from '../../../assets/icons/dire_square.webp?url';
import radiantCrest from '../../../assets/icons/radiant_square.webp?url';
import type {
  MatchChatMessage,
  MatchDetailPlayer,
  MatchDetailSnapshot,
} from '../lib/match-detail';
import { getAbilityIcon } from '../lib/ability-icons';
import { getItemIcon } from '../lib/item-icons';
import { talentDescriptions } from '../lib/talent-descriptions';
import { HeroMark } from './HeroMark';
import { HeroPortrait } from './HeroPortrait';
import { PlayerSortControls, type PlayerSort } from './PlayerSortControls';

type PerformanceRank = 1 | 2;

type MatchDetailViewProps = {
  detail?: MatchDetailSnapshot;
  heroNames: Record<number, string>;
  currentAccountId: number | null;
  isLoading: boolean;
  error: Error | null;
  parseError: Error | null;
  isParsing: boolean;
  parseDisabledReason?: string | null;
  backLabel?: string;
  onBack: () => void;
  onRefresh: () => void;
  onParse: () => void;
};

export function MatchDetailView({
  detail,
  heroNames,
  currentAccountId,
  isLoading,
  error,
  parseError,
  isParsing,
  parseDisabledReason = null,
  backLabel = 'Назад к архиву',
  onBack,
  onRefresh,
  onParse,
}: MatchDetailViewProps) {
  if (isLoading) {
    return <DetailMessage text="Собираем разбор матча…" backLabel={backLabel} onBack={onBack} />;
  }
  if (error) {
    return <DetailMessage text={error.message} tone="error" backLabel={backLabel} onBack={onBack} />;
  }
  if (!detail) {
    return <DetailMessage text="Матч не найден." backLabel={backLabel} onBack={onBack} />;
  }

  const radiantPlayers = detail.players.filter((player) => player.isRadiant);
  const direPlayers = detail.players.filter((player) => !player.isRadiant);

  const heroDamages = [...new Set(detail.players.map((p) => p.heroDamage))].sort((a, b) => b - a);
  const towerDamages = [...new Set(detail.players.map((p) => p.towerDamage))].sort((a, b) => b - a);
  const csValues = [...new Set(detail.players.map((p) => p.lastHits))].sort((a, b) => b - a);
  const skillsValues = [...new Set(detail.players.map((p) => p.abilityBuild.length))].sort((a, b) => b - a);

  const maxStats = {
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
  const focusedPlayer = currentAccountId === null
    ? null
    : detail.players.find((player) => player.accountId === currentAccountId) ?? null;
  const hasPlayerStats = detail.availableSections.includes('player_stats');
  const hasDetailSections = detail.availableSections.length > 0;
  const detailNotice = detail.detailStatus === 'available'
    ? null
    : hasDetailSections
      ? {
          title: 'Частичный разбор',
          message: 'Сохранённые данные уже показаны. Недостающие разделы можно дозагрузить или повторить загрузку полного разбора.',
        }
      : {
          title: 'Базовый разбор',
          message: 'Основная статистика уже доступна. Загрузите расширенный разбор для playback, abilities и подробных событий.',
        };
  const radiantLabel = detail.radiantWin === true ? 'WON' : detail.radiantWin === false ? 'LOST' : '—';
  const direLabel = detail.radiantWin === false ? 'WON' : detail.radiantWin === true ? 'LOST' : '—';

  return (
    <section className="match-detail" aria-label="Match detail">
      <div className="match-detail__toolbar">
        <button className="match-detail__back" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          {backLabel}
        </button>
        <div className="match-detail__signals">
          <span>Источник: {detail.source.toUpperCase()}</span>
          <span className={`detail-status detail-status--${detail.detailStatus}`}>
            {formatDetailStatus(detail.detailStatus)}
          </span>
          <button type="button" onClick={onRefresh}>Обновить</button>
        </div>
      </div>

      <header className="match-detail__scoreline">
        <TeamOutcome
          side="radiant"
          label="Radiant"
          outcome={radiantLabel}
          score={detail.radiantScore}
          won={detail.radiantWin === true}
        />
        <div className="match-detail__clock">
          <span className="micro-label">MATCH / {detail.matchId}</span>
          <strong>{formatDuration(detail.durationSeconds)}</strong>
          <span>{formatMode(detail.gameMode)} · {formatDate(detail.startTime)}</span>
        </div>
        <TeamOutcome
          side="dire"
          label="Dire"
          outcome={direLabel}
          score={detail.direScore}
          won={detail.radiantWin === false}
        />
      </header>

      {detailNotice ? (
        <div className="match-detail__notice">
          <div>
            <strong>{detailNotice.title}</strong>
            <span>{detailNotice.message}</span>
          </div>
          {parseDisabledReason ? (
            <span className="match-detail__parse-restriction">{parseDisabledReason}</span>
          ) : (
            <button type="button" onClick={onParse} disabled={isParsing}>
              {isParsing ? 'Загружаем детали…' : 'Загрузить полный разбор'}
            </button>
          )}
          {parseError ? <span className="match-detail__parse-error">{parseError.message}</span> : null}
        </div>
      ) : null}

      <TeamScoreboard
        radiantPlayers={radiantPlayers}
        direPlayers={direPlayers}
        heroNames={heroNames}
        currentAccountId={currentAccountId}
      />

      <div className="detail-analysis-grid">
        <section className="detail-panel detail-advantage" aria-labelledby="advantage-title">
          <DetailHeading eyebrow="ECONOMY / TIMELINE" title="Advantage curve" id="advantage-title" />
          <AdvantageChart
            networth={detail.radiantNetworthLeads}
            experience={detail.radiantExperienceLeads}
          />
        </section>

        <section className="detail-panel detail-lanes" aria-labelledby="lanes-title">
          <DetailHeading eyebrow="LANES / OUTCOME" title="Opening map" id="lanes-title" />
          <div className="detail-lanes__list">
            {detail.laneOutcomes.map((lane) => {
              const outcomeClass = lane.outcome.toLowerCase().replace('_', '-');
              return (
                <article key={lane.lane} className={`lane-outcome-row lane-outcome-row--${outcomeClass}`}>
                  <span>{lane.lane}</span>
                  <strong>{formatEnum(lane.outcome)}</strong>
                </article>
              );
            })}
          </div>
          <div className="detail-events">
            <span className="detail-events__scope">MATCH EVENTS / ALL PLAYERS</span>
            {Object.entries(detail.eventCounts).map(([label, count]) => (
              <span key={label} title={matchEventDescription(label)} className={count === null ? 'is-empty' : 'has-values'}>
                <strong>{count === null ? 'N/A' : count}</strong>{label}
              </span>
            ))}
          </div>
        </section>
      </div>

      {hasPlayerStats && focusedPlayer ? (
        <FullPlayerAnalysis player={focusedPlayer} heroNames={heroNames} />
      ) : null}

      {detail.chatMessages.length > 0 ? (
        <MatchChatPanel messages={detail.chatMessages} heroNames={heroNames} />
      ) : null}

      <section className="detail-panel detail-draft" aria-labelledby="draft-title">
        <DetailHeading eyebrow="DRAFT / ORDER" title="Picks and bans" id="draft-title" />
        {detail.pickBans.length === 0 ? (
          <p className="detail-empty">Draft data is not available for this match.</p>
        ) : (
          <div className="detail-draft__sequence">
            {detail.pickBans.map((entry, index) => {
              const label = heroNames[entry.heroId] ?? `Hero #${entry.heroId}`;
              const teamClass = entry.isRadiant === true ? 'is-team-radiant' : entry.isRadiant === false ? 'is-team-dire' : '';
              return (
                <article
                  className={`detail-draft__entry ${entry.isPick ? 'is-pick' : 'is-ban'} ${teamClass}`}
                  key={`${entry.order ?? index}-${entry.heroId}`}
                >
                  <span>{entry.order ?? index + 1}</span>
                  <HeroMark heroId={entry.heroId} label={label} fallback={label.slice(0, 2).toUpperCase()} className="detail-draft__hero-mark" />
                  <strong>{label}</strong>
                  <small>{entry.isPick ? 'PICK' : 'BAN'} · {entry.isRadiant === true ? 'R' : entry.isRadiant === false ? 'D' : '?'}</small>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <TeamBuilds
        radiantPlayers={radiantPlayers}
        direPlayers={direPlayers}
        heroNames={heroNames}
        currentAccountId={currentAccountId}
        maxStats={maxStats}
        rosterStatus={detail.rosterStatus}
        playerCount={detail.players.length}
      />
    </section>
  );
}

function MatchChatPanel({
  messages,
  heroNames,
}: {
  messages: MatchChatMessage[];
  heroNames: Record<number, string>;
}) {
  const textCount = messages.filter((message) => message.type === 'text').length;
  const wheelCount = messages.length - textCount;
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'text' | 'all'>(textCount > 0 ? 'text' : 'all');
  const visibleMessages = filter === 'all'
    ? messages
    : messages.filter((message) => message.type === 'text');

  return (
    <section className={`detail-panel match-chat${isOpen ? ' is-open' : ''}`} aria-labelledby="match-chat-title">
      <div className="match-chat__header">
        <div>
          <span className="micro-label">COMMS / OPTIONAL TRANSCRIPT</span>
          <h3 id="match-chat-title">Match chat</h3>
          <p>{textCount} messages · {wheelCount} chat-wheel events</p>
        </div>
        <button type="button" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen}>
          {isOpen ? 'Скрыть чат' : 'Показать чат'}
        </button>
      </div>
      {isOpen ? (
        <div className="match-chat__body">
          <div className="match-chat__controls">
            <span>Необработанный игровой чат может содержать оскорбления.</span>
            <div>
              <button
                className={filter === 'text' ? 'is-active' : ''}
                type="button"
                onClick={() => setFilter('text')}
                disabled={textCount === 0}
              >
                Только текст
              </button>
              <button
                className={filter === 'all' ? 'is-active' : ''}
                type="button"
                onClick={() => setFilter('all')}
              >
                Всё
              </button>
            </div>
          </div>
          <div className="match-chat__transcript" role="log" aria-label="Чат матча">
            {visibleMessages.map((message) => (
              <ChatMessage key={message.key} message={message} heroNames={heroNames} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ChatMessage({
  message,
  heroNames,
}: {
  message: MatchChatMessage;
  heroNames: Record<number, string>;
}) {
  return (
    <article className={`chat-message ${message.isRadiant === true ? 'is-radiant' : message.isRadiant === false ? 'is-dire' : ''}`}>
      <time>{formatEventTime(message.time)}</time>
      <MatchDetailHeroMark heroId={message.heroId} heroNames={heroNames} />
      <div>
        <strong>{message.playerName ?? formatAccount(message.accountId)}</strong>
        <span>{heroLabel(message.heroId, heroNames)}</span>
        <p>{message.type === 'text' ? message.message : `Chat wheel #${message.chatWheelId}`}</p>
      </div>
    </article>
  );
}

function TeamOutcome({
  side,
  label,
  outcome,
  score,
  won,
}: {
  side: 'radiant' | 'dire';
  label: string;
  outcome: string;
  score: number;
  won: boolean;
}) {
  const crestSrc = side === 'radiant' ? radiantCrest : direCrest;

  return (
    <div className={`team-outcome team-outcome--${side}${won ? ' is-winner' : ''}`}>
      <span className="team-outcome__crest" aria-hidden="true">
        <img src={crestSrc} alt="" />
      </span>
      <div>
        <span className="micro-label">{outcome}</span>
        <strong>{label}</strong>
      </div>
      <span className="team-outcome__score">{score}</span>
    </div>
  );
}

function TeamScoreboard({
  radiantPlayers,
  direPlayers,
  heroNames,
  currentAccountId,
}: {
  radiantPlayers: MatchDetailPlayer[];
  direPlayers: MatchDetailPlayer[];
  heroNames: Record<number, string>;
  currentAccountId: number | null;
}) {
  const [sort, setSort] = useState<PlayerSort>('slot');
  const performanceRanks = rankPlayersByImp([...radiantPlayers, ...direPlayers]);

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
        />
        <div className="detail-scoreboard__versus">VS</div>
        <TeamRoster
          label="Dire"
          players={direPlayers}
          heroNames={heroNames}
          currentAccountId={currentAccountId}
          sort={sort}
          performanceRanks={performanceRanks}
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
}: {
  label: string;
  players: MatchDetailPlayer[];
  heroNames: Record<number, string>;
  currentAccountId: number | null;
  sort: PlayerSort;
  performanceRanks: Map<string, PerformanceRank>;
}) {
  const orderedPlayers = sortPlayers(players, sort);

  return (
    <div className="team-roster">
      <span className="team-roster__label">{label}</span>
      {orderedPlayers.map((player) => {
        const performanceRank = performanceRanks.get(player.key);
        const playerLabel = player.name ?? formatAccount(player.accountId);
        const rankClass = performanceRank === 1 ? ' is-highest' : performanceRank === 2 ? ' is-second' : '';
        const currentClass = currentAccountId !== null && player.accountId === currentAccountId ? ' is-current' : '';

        return (
          <article
            className={`scoreboard-player ${player.isRadiant ? 'is-radiant' : 'is-dire'}${rankClass}${currentClass}`}
            key={player.key}
            aria-label={`Scoreboard entry for ${playerLabel}`}
          >
            <MatchDetailHeroMark heroId={player.heroId} heroNames={heroNames} />
            <div className="scoreboard-player__identity">
              <strong>{playerLabel}</strong>
              <span>{heroLabel(player.heroId, heroNames)} · {formatEnum(player.role ?? 'UNKNOWN')}</span>
              {performanceRank ? <span className="scoreboard-player__performance-rank">TOP {performanceRank} IMP</span> : null}
            </div>
            <strong className="scoreboard-player__kda">
              {player.kills} / {player.deaths} / {player.assists}
            </strong>
            <div className="scoreboard-player__economy">
              <span>{player.goldPerMinute} <small>GPM</small></span>
              <span>{player.xpPerMinute} <small>XPM</small></span>
            </div>
            <span className="scoreboard-player__net">{formatCompact(player.netWorth)}</span>
          </article>
        );
      })}
    </div>
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

function AdvantageChart({ networth, experience }: { networth: number[]; experience: number[] }) {
  const maxPoints = Math.max(networth.length, experience.length);
  if (maxPoints < 2) {
    return <p className="detail-empty">Timeline will appear after STRATZ parsing.</p>;
  }
  const absoluteMax = Math.max(
    1,
    ...networth.map(Math.abs),
    ...experience.map(Math.abs),
  );
  const networthPoints = chartPoints(networth, absoluteMax);
  const experiencePoints = chartPoints(experience, absoluteMax);

  return (
    <div className="advantage-chart">
      <div className="advantage-chart__legend">
        <span><i className="is-net" />Net worth</span>
        <span><i className="is-xp" />Experience</span>
        <strong>RADIANT + / DIRE −</strong>
      </div>
      <svg viewBox="0 0 100 48" role="img" aria-label="График преимущества команд">
        <line x1="0" x2="100" y1="24" y2="24" />
        <polyline className="is-net" points={networthPoints} />
        <polyline className="is-xp" points={experiencePoints} />
      </svg>
      <div className="advantage-chart__axis"><span>00:00</span><span>{formatDuration((maxPoints - 1) * 60)}</span></div>
    </div>
  );
}

function TeamBuilds({
  radiantPlayers,
  direPlayers,
  heroNames,
  currentAccountId,
  maxStats,
  rosterStatus,
  playerCount,
}: {
  radiantPlayers: MatchDetailPlayer[];
  direPlayers: MatchDetailPlayer[];
  heroNames: Record<number, string>;
  currentAccountId: number | null;
  maxStats: {
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
  rosterStatus: MatchDetailSnapshot['rosterStatus'];
  playerCount: number;
}) {
  const [sort, setSort] = useState<PlayerSort>('slot');

  return (
    <section className="detail-panel detail-builds" aria-labelledby="builds-title">
      <div className="detail-builds__header">
        <DetailHeading eyebrow="LOADOUT / BUILDS" title="Team builds" id="builds-title" />
        <PlayerSortControls value={sort} onChange={setSort} ariaLabel="Sort team builds" />
      </div>
      {rosterStatus === 'incomplete' ? (
        <p className="detail-builds__roster-status">{playerCount}/10 players captured</p>
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
  maxStats: {
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

function sortPlayers(players: MatchDetailPlayer[], sort: PlayerSort): MatchDetailPlayer[] {
  return [...players].sort((left, right) => {
    if (sort === 'slot') {
      return left.playerSlot - right.playerSlot;
    }

    const leftValue = playerSortValue(left, sort);
    const rightValue = playerSortValue(right, sort);
    if (leftValue === null && rightValue !== null) {
      return 1;
    }
    if (leftValue !== null && rightValue === null) {
      return -1;
    }
    if (leftValue !== null && rightValue !== null && leftValue !== rightValue) {
      return rightValue - leftValue;
    }
    return left.playerSlot - right.playerSlot;
  });
}

function playerSortValue(player: MatchDetailPlayer, sort: Exclude<PlayerSort, 'slot'>): number | null {
  if (sort === 'imp') {
    return player.imp;
  }
  if (sort === 'heroDamage') {
    return player.heroDamage;
  }
  return player.towerDamage;
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
  maxStats: {
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

function FullPlayerAnalysis({
  player,
  heroNames,
}: {
  player: MatchDetailPlayer;
  heroNames: Record<number, string>;
}) {
  return (
    <section className="detail-panel full-analysis" aria-labelledby="full-analysis-title">
      <DetailHeading
        eyebrow="FULL DETAIL / PLAYER FOCUS"
        title={`${heroLabel(player.heroId, heroNames)} performance tape`}
        id="full-analysis-title"
      />
      <div className="full-analysis__summary">
        <AnalysisMetric label="Impact" value={player.imp === null ? '—' : `${player.imp > 0 ? '+' : ''}${player.imp}`} />
        <AnalysisMetric label="Award" value={formatEnum(player.award ?? 'NONE')} />
        <AnalysisMetric label="Dota Plus" value={player.dotaPlusLevel === null ? '—' : `Level ${player.dotaPlusLevel}`} />
        <AnalysisMetric label="Actions" value={player.totalActions === null ? '—' : formatCompact(player.totalActions)} />
      </div>
      <div className="full-analysis__body">
        <div className="full-analysis__timelines">
          <span className="micro-label">PER-MINUTE CURVES</span>
          <MinuteSeries label="Gold" values={player.minuteSeries.gold} tone="gold" />
          <MinuteSeries label="XP" values={player.minuteSeries.experience} tone="xp" />
          <MinuteSeries label="Net worth" values={player.minuteSeries.netWorth} tone="net" />
          <MinuteSeries label="Hero damage" values={player.minuteSeries.heroDamage} tone="damage" />
        </div>
        <div className="full-analysis__events">
          <span className="micro-label">PLAYER EVENTS / SELECTED PLAYER</span>
          <div className="event-ledger">
            {Object.entries(player.detailEvents).map(([label, count]) => (
              <span key={label}><strong>{count}</strong>{formatEnum(label)}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
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

function MatchDetailHeroMark({ heroId, heroNames }: { heroId: number | null; heroNames: Record<number, string> }) {
  const label = heroLabel(heroId, heroNames);
  return <HeroMark heroId={heroId} label={label} fallback={heroMark(heroId, heroNames)} className="scoreboard-player__hero" />;
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

function AnalysisMetric({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span className="micro-label">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function MinuteSeries({
  label,
  values,
  tone,
}: {
  label: string;
  values: number[];
  tone: 'gold' | 'xp' | 'net' | 'damage';
}) {
  const max = Math.max(1, ...values);
  const points = values
    .map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * 100;
      return `${x.toFixed(2)},${(28 - (value / max) * 24).toFixed(2)}`;
    })
    .join(' ');
  return (
    <div className={`minute-series minute-series--${tone}`}>
      <div><span>{label}</span><strong>{values.at(-1) ?? 0}</strong></div>
      {values.length > 1 ? (
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-label={`${label} по минутам`}>
          <polyline points={points} />
        </svg>
      ) : (
        <span className="minute-series__empty">No timeline</span>
      )}
    </div>
  );
}

function DetailHeading({ eyebrow, title, id }: { eyebrow: string; title: string; id: string }) {
  return (
    <div className="detail-heading">
      <span className="micro-label">{eyebrow}</span>
      <h3 id={id}>{title}</h3>
    </div>
  );
}

function DetailMessage({
  text,
  tone = 'neutral',
  backLabel,
  onBack,
}: {
  text: string;
  tone?: 'neutral' | 'error';
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className={`detail-message detail-message--${tone}`}>
      <button type="button" onClick={onBack}>← {backLabel}</button>
      <p>{text}</p>
    </div>
  );
}

function chartPoints(values: number[], absoluteMax: number): string {
  return values
    .map((value, index) => {
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * 100;
      const y = 24 - (value / absoluteMax) * 21;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function heroLabel(heroId: number | null, heroNames: Record<number, string>): string {
  return heroId === null ? 'Unknown hero' : heroNames[heroId] ?? `Hero #${heroId}`;
}

function heroMark(heroId: number | null, heroNames: Record<number, string>): string {
  return heroId === null ? '?' : heroLabel(heroId, heroNames).slice(0, 2).toUpperCase();
}

function formatAccount(accountId: number | null): string {
  return accountId === null ? 'Anonymous player' : `Player #${accountId}`;
}

function formatEnum(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatDetailStatus(status: string): string {
  return {
    not_requested: 'Базовые данные',
    pending: 'В очереди',
    available: 'Полный разбор',
    unavailable: 'Детали недоступны',
    failed: 'Ошибка деталей',
  }[status] ?? formatEnum(status);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatEventTime(seconds: number): string {
  const sign = seconds < 0 ? '−' : '';
  const absolute = Math.abs(seconds);
  return `${sign}${Math.floor(absolute / 60)}:${(absolute % 60).toString().padStart(2, '0')}`;
}

function formatAbilityName(name: string | null, abilityId: number): string {
  if (!name) return `Ability #${abilityId}`;
  const readable = name.includes('_') ? name.split('_').slice(1).join(' ') : name;
  return readable.replace(/^./, (letter) => letter.toUpperCase());
}

function matchEventDescription(label: string): string {
  return {
    chat: 'Сообщения и chat-wheel события всего матча',
    towers: 'События разрушения башен всего матча',
    runes: 'Глобальные события рун из match playback',
    wards: 'Глобальные события установки и уничтожения вардов',
    buildings: 'Изменения состояния строений из match playback',
    roshan: 'События Roshan из match playback',
  }[label] ?? label;
}

function formatMode(mode: number | null): string {
  return { 1: 'All Pick', 22: 'Ranked All Pick', 23: 'Turbo' }[mode ?? -1] ?? 'Dota 2';
}

function formatDate(timestamp: number | null): string {
  if (timestamp === null) return 'Unknown date';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1_000));
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}
