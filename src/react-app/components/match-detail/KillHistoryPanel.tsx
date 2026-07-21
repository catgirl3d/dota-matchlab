import type { MatchDetailPlayer, MatchDetailSnapshot, MatchTimelineEvent, MatchTimelineParticipant } from '../../lib/match-detail';
import { useTranslation } from '../../lib/i18n';
import { FilterDropdown } from '../FilterDropdown';
import { HeroMark } from '../HeroMark';
import { formatEventTime, heroLabel, heroMark } from './match-detail-display';
import { DetailHeading } from './match-detail-primitives';

type KillHistoryPanelProps = {
  events: MatchTimelineEvent[];
  players: MatchDetailSnapshot['players'];
  heroNames: Record<number, string>;
  isAvailable: boolean;
  selectedPlayerKey: string | null;
  onPlayerSelect: (playerKey: string | null) => void;
};

export function KillHistoryPanel({ events, players, heroNames, isAvailable, selectedPlayerKey, onPlayerSelect }: KillHistoryPanelProps) {
  const { t } = useTranslation();
  const kills = events.filter((event) => event.type === 'kill');
  const heroOptions = buildHeroOptions(players, heroNames, t('killHistoryAllHeroes'));
  const selectedPlayer = players.find((player) => player.key === selectedPlayerKey) ?? null;
  const activePlayerKey = selectedPlayer?.key ?? 'all';
  const filteredKills = selectedPlayer === null
    ? kills
    : kills.filter((event) => eventIncludesPlayer(event, selectedPlayer));

  return (
    <section className="detail-panel detail-kill-history" aria-labelledby="kill-history-title">
      <div className="kill-history__header">
        <DetailHeading eyebrow={t('killHistoryEyebrow')} title={t('killHistoryTitle')} id="kill-history-title" />
        {activePlayerKey !== 'all' ? (
          <button
            className="filter-reset"
            type="button"
            aria-label={t('resetHeroFilterAriaLabel')}
            title={t('resetHeroFilterAriaLabel')}
            onClick={() => onPlayerSelect(null)}
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>
      <div className={`kill-history${isAvailable ? ' has-filter' : ''}`}>
        {isAvailable ? (
          <div className="kill-history__filter">
            <FilterDropdown label={t('killHistoryHeroFilter')} value={activePlayerKey} options={heroOptions} onChange={(playerKey) => onPlayerSelect(playerKey === 'all' ? null : playerKey)} />
          </div>
        ) : null}
        {!isAvailable ? <p className="kill-history__empty">{t('killHistoryUnavailable')}</p> : filteredKills.length === 0 ? <p className="kill-history__empty">{activePlayerKey === 'all' ? t('killHistoryEmpty') : t('killHistoryFilteredEmpty')}</p> : (
          <ol className="kill-history__list" aria-label={t('killHistoryListAriaLabel')}>
            {filteredKills.map((event) => <KillHistoryEntry activePlayerKey={activePlayerKey} event={event} heroNames={heroNames} key={event.key} onPlayerSelect={onPlayerSelect} players={players} />)}
          </ol>
        )}
      </div>
    </section>
  );
}

function buildHeroOptions(
  players: MatchDetailSnapshot['players'],
  heroNames: Record<number, string>,
  allHeroesLabel: string,
): Array<readonly [string, string]> {
  return [
    ['all', allHeroesLabel],
    ...players
      .filter((player) => player.heroId !== null)
      .map((player) => [player.key, heroLabel(player.heroId, heroNames)] as const),
  ];
}

function KillHistoryEntry({
  event,
  heroNames,
  activePlayerKey,
  onPlayerSelect,
  players,
}: {
  event: MatchTimelineEvent;
  heroNames: Record<number, string>;
  activePlayerKey: string;
  onPlayerSelect: (playerKey: string | null) => void;
  players: MatchDetailPlayer[];
}) {
  const actorLabel = participantLabel(event.actor, heroNames);
  const targetLabel = participantLabel(event.target, heroNames);
  const time = formatEventTime(event.time);
  const teamClass = event.isRadiant === true ? ' is-radiant' : event.isRadiant === false ? ' is-dire' : '';

  return (
    <li className={`kill-history__entry${teamClass}`} aria-label={`${actorLabel} killed ${targetLabel} at ${time}`}>
      <time>{time}</time>
      <KillHistoryHeroButton activePlayerKey={activePlayerKey} heroId={event.actor?.heroId ?? null} heroNames={heroNames} label={actorLabel} onSelect={onPlayerSelect} playerKey={playerKeyForParticipant(event.actor, players)} />
      <span className="kill-history__action" aria-hidden="true">→</span>
      <KillHistoryHeroButton activePlayerKey={activePlayerKey} heroId={event.target?.heroId ?? null} heroNames={heroNames} label={targetLabel} onSelect={onPlayerSelect} playerKey={playerKeyForParticipant(event.target, players)} />
    </li>
  );
}

function KillHistoryHeroButton({
  heroId,
  heroNames,
  label,
  activePlayerKey,
  onSelect,
  playerKey,
}: {
  heroId: number | null;
  heroNames: Record<number, string>;
  label: string;
  activePlayerKey: string;
  onSelect: (playerKey: string | null) => void;
  playerKey: string | null;
}) {
  const { t } = useTranslation();
  const isSelectable = playerKey !== null;
  const heroName = heroLabel(heroId, heroNames);

  return (
    <button
      className="kill-history__hero"
      type="button"
      aria-label={t('filterByHero', { hero: heroName })}
      aria-pressed={isSelectable ? activePlayerKey === playerKey : undefined}
      disabled={!isSelectable}
      onClick={() => onSelect(playerKey)}
    >
      <HeroMark heroId={heroId} label={label} fallback={heroMark(heroId, heroNames)} className="kill-history__hero-mark" />
    </button>
  );
}

function eventIncludesPlayer(event: MatchTimelineEvent, player: MatchDetailPlayer): boolean {
  return participantMatchesPlayer(event.actor, player) || participantMatchesPlayer(event.target, player);
}

function participantMatchesPlayer(participant: MatchTimelineParticipant | null, player: MatchDetailPlayer): boolean {
  if (participant === null) return false;
  if (player.accountId !== null && participant.accountId !== null) return player.accountId === participant.accountId;
  return player.heroId !== null && player.heroId === participant.heroId;
}

function playerKeyForParticipant(participant: MatchTimelineParticipant | null, players: MatchDetailPlayer[]): string | null {
  if (participant === null) return null;
  const accountPlayer = participant.accountId === null
    ? null
    : players.find((player) => player.accountId === participant.accountId) ?? null;
  return accountPlayer?.key ?? players.find((player) => player.heroId === participant.heroId)?.key ?? null;
}

function participantLabel(participant: MatchTimelineParticipant | null, heroNames: Record<number, string>): string {
  return participant?.name ?? heroLabel(participant?.heroId ?? null, heroNames);
}
