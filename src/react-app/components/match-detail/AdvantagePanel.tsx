import type { MatchDetailSnapshot } from '../../lib/match-detail';
import { useTranslation } from '../../lib/i18n';
import { AdvantageTimeline } from '../AdvantageTimeline';
import { DetailHeading } from './match-detail-primitives';

type AdvantagePanelProps = {
  networth: number[];
  experience: number[];
  durationSeconds: number | null;
  events: MatchDetailSnapshot['timelineEvents'];
};

export function AdvantagePanel({ networth, experience, durationSeconds, events }: AdvantagePanelProps) {
  const { t } = useTranslation();

  return (
    <section className="detail-panel detail-advantage" aria-labelledby="advantage-title">
      <DetailHeading eyebrow={t('economyTimeline')} title={t('advantageCurve')} id="advantage-title" />
      <AdvantageTimeline
        networth={networth}
        experience={experience}
        durationSeconds={durationSeconds}
        events={events}
      />
    </section>
  );
}
