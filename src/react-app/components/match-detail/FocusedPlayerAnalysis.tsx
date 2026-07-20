import type { MatchDetailPlayer } from '../../lib/match-detail';
import { PlayerMinuteCharts } from '../PlayerMinuteCharts';
import { formatCompact, formatEnum, heroLabel } from './match-detail-display';
import { DetailHeading } from './match-detail-primitives';

type FocusedPlayerAnalysisProps = {
  player: MatchDetailPlayer;
  heroNames: Record<number, string>;
  durationSeconds: number | null;
};

export function FocusedPlayerAnalysis({ player, heroNames, durationSeconds }: FocusedPlayerAnalysisProps) {
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
          <PlayerMinuteCharts durationSeconds={durationSeconds} series={player.minuteSeries} />
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

function AnalysisMetric({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span className="micro-label">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
