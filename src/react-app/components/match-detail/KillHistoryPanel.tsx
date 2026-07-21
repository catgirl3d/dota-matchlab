import { useState } from 'react';
import type { MatchDetailSnapshot, MatchTimelineEvent, MatchTimelineParticipant } from '../../lib/match-detail';
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
};

export function KillHistoryPanel({ events, players, heroNames, isAvailable }: KillHistoryPanelProps) {
  const { t } = useTranslation();
  const [selectedHeroId, setSelectedHeroId] = useState('all');
  const kills = events.filter((event) => event.type === 'kill');
  const heroOptions = buildHeroOptions(players, heroNames, t('killHistoryAllHeroes'));
  const activeHeroId = heroOptions.some(([value]) => value === selectedHeroId) ? selectedHeroId : 'all';
  const filteredKills = activeHeroId === 'all'
    ? kills
    : kills.filter((event) => event.actor?.heroId === Number(activeHeroId) || event.target?.heroId === Number(activeHeroId));
  const selectHero = (heroId: number | null) => {
    const nextHeroId = heroId === null ? null : String(heroId);
    if (nextHeroId !== null && heroOptions.some(([value]) => value === nextHeroId)) {
      setSelectedHeroId(nextHeroId);
    }
  };

  return (
    <section className="detail-panel detail-kill-history" aria-labelledby="kill-history-title">
      <div className="kill-history__header">
        <DetailHeading eyebrow={t('killHistoryEyebrow')} title={t('killHistoryTitle')} id="kill-history-title" />
        {activeHeroId !== 'all' ? (
          <button
            className="filter-reset"
            type="button"
            aria-label={t('resetHeroFilterAriaLabel')}
            title={t('resetHeroFilterAriaLabel')}
            onClick={() => setSelectedHeroId('all')}
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>
      <div className={`kill-history${isAvailable ? ' has-filter' : ''}`}>
        {isAvailable ? (
          <div className="kill-history__filter">
            <FilterDropdown label={t('killHistoryHeroFilter')} value={activeHeroId} options={heroOptions} onChange={setSelectedHeroId} />
          </div>
        ) : null}
        {!isAvailable ? <p className="kill-history__empty">{t('killHistoryUnavailable')}</p> : filteredKills.length === 0 ? <p className="kill-history__empty">{activeHeroId === 'all' ? t('killHistoryEmpty') : t('killHistoryFilteredEmpty')}</p> : (
          <ol className="kill-history__list" aria-label={t('killHistoryListAriaLabel')}>
            {filteredKills.map((event) => <KillHistoryEntry activeHeroId={activeHeroId} event={event} heroNames={heroNames} key={event.key} onHeroSelect={selectHero} />)}
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
  const heroes = new Map<number, string>();

  for (const player of players) {
    if (player.heroId !== null) {
      heroes.set(player.heroId, heroLabel(player.heroId, heroNames));
    }
  }

  return [['all', allHeroesLabel], ...Array.from(heroes, ([heroId, label]) => [String(heroId), label] as const)];
}

function KillHistoryEntry({
  event,
  heroNames,
  activeHeroId,
  onHeroSelect,
}: {
  event: MatchTimelineEvent;
  heroNames: Record<number, string>;
  activeHeroId: string;
  onHeroSelect: (heroId: number | null) => void;
}) {
  const actorLabel = participantLabel(event.actor, heroNames);
  const targetLabel = participantLabel(event.target, heroNames);
  const actorHeroId = event.actor?.heroId ?? null;
  const targetHeroId = event.target?.heroId ?? null;
  const time = formatEventTime(event.time);
  const teamClass = event.isRadiant === true ? ' is-radiant' : event.isRadiant === false ? ' is-dire' : '';

  return (
    <li className={`kill-history__entry${teamClass}`} aria-label={`${actorLabel} killed ${targetLabel} at ${time}`}>
      <time>{time}</time>
      <KillHistoryHeroButton activeHeroId={activeHeroId} heroId={actorHeroId} heroNames={heroNames} label={actorLabel} onSelect={onHeroSelect} />
      <span className="kill-history__action" aria-hidden="true">→</span>
      <KillHistoryHeroButton activeHeroId={activeHeroId} heroId={targetHeroId} heroNames={heroNames} label={targetLabel} onSelect={onHeroSelect} />
    </li>
  );
}

function KillHistoryHeroButton({
  heroId,
  heroNames,
  label,
  activeHeroId,
  onSelect,
}: {
  heroId: number | null;
  heroNames: Record<number, string>;
  label: string;
  activeHeroId: string;
  onSelect: (heroId: number | null) => void;
}) {
  const { t } = useTranslation();
  const isSelectable = heroId !== null;
  const heroName = heroLabel(heroId, heroNames);

  return (
    <button
      className="kill-history__hero"
      type="button"
      aria-label={t('filterByHero', { hero: heroName })}
      aria-pressed={isSelectable ? activeHeroId === String(heroId) : undefined}
      disabled={!isSelectable}
      onClick={() => onSelect(heroId)}
    >
      <HeroMark heroId={heroId} label={label} fallback={heroMark(heroId, heroNames)} className="kill-history__hero-mark" />
    </button>
  );
}

function participantLabel(participant: MatchTimelineParticipant | null, heroNames: Record<number, string>): string {
  return participant?.name ?? heroLabel(participant?.heroId ?? null, heroNames);
}
