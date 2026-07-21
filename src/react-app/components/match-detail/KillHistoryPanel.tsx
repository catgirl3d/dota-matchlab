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

  return (
    <section className="detail-panel detail-kill-history" aria-labelledby="kill-history-title">
      <DetailHeading eyebrow={t('killHistoryEyebrow')} title={t('killHistoryTitle')} id="kill-history-title" />
      <div className={`kill-history${isAvailable ? ' has-filter' : ''}`}>
        {isAvailable ? (
          <div className="kill-history__filter">
            <FilterDropdown label={t('killHistoryHeroFilter')} value={activeHeroId} options={heroOptions} onChange={setSelectedHeroId} />
          </div>
        ) : null}
        {!isAvailable ? <p className="kill-history__empty">{t('killHistoryUnavailable')}</p> : filteredKills.length === 0 ? <p className="kill-history__empty">{activeHeroId === 'all' ? t('killHistoryEmpty') : t('killHistoryFilteredEmpty')}</p> : (
          <ol className="kill-history__list" aria-label={t('killHistoryListAriaLabel')}>
            {filteredKills.map((event) => <KillHistoryEntry event={event} heroNames={heroNames} key={event.key} />)}
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

function KillHistoryEntry({ event, heroNames }: { event: MatchTimelineEvent; heroNames: Record<number, string> }) {
  const actorLabel = participantLabel(event.actor, heroNames);
  const targetLabel = participantLabel(event.target, heroNames);
  const time = formatEventTime(event.time);
  const teamClass = event.isRadiant === true ? ' is-radiant' : event.isRadiant === false ? ' is-dire' : '';

  return (
    <li className={`kill-history__entry${teamClass}`} aria-label={`${actorLabel} killed ${targetLabel} at ${time}`}>
      <time>{time}</time>
      <HeroMark heroId={event.actor?.heroId ?? null} label={actorLabel} fallback={heroMark(event.actor?.heroId ?? null, heroNames)} className="kill-history__hero" />
      <span className="kill-history__action" aria-hidden="true">→</span>
      <HeroMark heroId={event.target?.heroId ?? null} label={targetLabel} fallback={heroMark(event.target?.heroId ?? null, heroNames)} className="kill-history__hero" />
    </li>
  );
}

function participantLabel(participant: MatchTimelineParticipant | null, heroNames: Record<number, string>): string {
  return participant?.name ?? heroLabel(participant?.heroId ?? null, heroNames);
}
