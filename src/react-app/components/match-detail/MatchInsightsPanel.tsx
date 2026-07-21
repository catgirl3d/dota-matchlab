import type { MatchDetailSnapshot } from '../../lib/match-detail';
import { AdvantageTimeline } from '../AdvantageTimeline';
import { DetailHeading } from './match-detail-primitives';
import { useTranslation } from '../../lib/i18n';
import { LaneAnalysisPanel } from './LaneAnalysisPanel';
import { KillHistoryPanel } from './KillHistoryPanel';

type MatchInsightsPanelProps = {
  networth: number[];
  experience: number[];
  durationSeconds: number | null;
  events: MatchDetailSnapshot['timelineEvents'];
  players: MatchDetailSnapshot['players'];
  heroNames: Record<number, string>;
  laneOutcomes: MatchDetailSnapshot['laneOutcomes'];
  eventCounts: MatchDetailSnapshot['eventCounts'];
  hasPlayerStats: boolean;
};

export function MatchInsightsPanel({
  networth,
  experience,
  durationSeconds,
  events,
  players,
  heroNames,
  laneOutcomes,
  eventCounts,
  hasPlayerStats,
}: MatchInsightsPanelProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="detail-insights__primary">
        <section className="detail-panel detail-advantage" aria-labelledby="advantage-title">
          <DetailHeading eyebrow={t('economyTimeline')} title={t('advantageCurve')} id="advantage-title" />
          <AdvantageTimeline
            networth={networth}
            experience={experience}
            durationSeconds={durationSeconds}
            events={events}
          />
        </section>
        <KillHistoryPanel events={events} players={players} heroNames={heroNames} isAvailable={hasPlayerStats} />
      </div>

      <LaneAnalysisPanel players={players} heroNames={heroNames} laneOutcomes={laneOutcomes} eventCounts={eventCounts} />
    </>
  );
}
