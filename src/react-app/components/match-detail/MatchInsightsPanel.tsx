import type { MatchDetailSnapshot } from '../../lib/match-detail';
import { AdvantageTimeline } from '../AdvantageTimeline';
import { formatEnum } from './match-detail-display';
import { DetailHeading } from './match-detail-primitives';
import { useTranslation, type TranslationKey } from '../../lib/i18n';

type MatchInsightsPanelProps = {
  networth: number[];
  experience: number[];
  durationSeconds: number | null;
  events: MatchDetailSnapshot['timelineEvents'];
  laneOutcomes: MatchDetailSnapshot['laneOutcomes'];
  eventCounts: MatchDetailSnapshot['eventCounts'];
};

export function MatchInsightsPanel({
  networth,
  experience,
  durationSeconds,
  events,
  laneOutcomes,
  eventCounts,
}: MatchInsightsPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="detail-analysis-grid">
      <section className="detail-panel detail-advantage" aria-labelledby="advantage-title">
        <DetailHeading eyebrow={t('economyTimeline')} title={t('advantageCurve')} id="advantage-title" />
        <AdvantageTimeline
          networth={networth}
          experience={experience}
          durationSeconds={durationSeconds}
          events={events}
        />
      </section>

      <section className="detail-panel detail-lanes" aria-labelledby="lanes-title">
        <DetailHeading eyebrow={t('lanesOutcome')} title={t('openingMap')} id="lanes-title" />
        <div className="detail-lanes__list">
          {laneOutcomes.map((lane) => {
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
          <span className="detail-events__scope">{t('matchEventsAllPlayers')}</span>
          {Object.entries(eventCounts).map(([label, count]) => (
            <span key={label} title={matchEventDescription(label, t)} className={count === null ? 'is-empty' : 'has-values'}>
              <strong>{count === null ? 'N/A' : count}</strong>{label}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function matchEventDescription(label: string, t: (key: TranslationKey) => string): string {
  const keys: Record<string, TranslationKey> = {
    chat: 'insightChat',
    towers: 'insightTowers',
    runes: 'insightRunes',
    wards: 'insightWards',
    buildings: 'insightBuildings',
    roshan: 'insightRoshan',
  };
  const key = keys[label];
  return key ? t(key) : label;
}
