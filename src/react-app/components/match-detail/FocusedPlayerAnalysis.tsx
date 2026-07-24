import type { MatchDetailPlayer } from '../../lib/match-detail';
import { PlayerMinuteCharts } from '../PlayerMinuteCharts';
import { formatCompact, formatEnum, heroLabel } from './match-detail-display';
import { DetailPlayerIdentity } from './DetailPlayerIdentity';

type FocusedPlayerAnalysisProps = {
  player: MatchDetailPlayer;
  heroNames: Record<number, string>;
  durationSeconds: number | null;
};

export function FocusedPlayerAnalysis({ player, heroNames, durationSeconds }: FocusedPlayerAnalysisProps) {
  const levelCapReached = player.level >= MAX_PLAYER_LEVEL && hasTrailingZeroTail(player.minuteSeries.experience);
  const hero = heroLabel(player.heroId, heroNames);
  const teamLabel = player.isRadiant ? 'RADIANT' : 'DIRE';

  return (
    <section className={`detail-panel full-analysis full-analysis--${player.isRadiant ? 'radiant' : 'dire'}`} aria-labelledby="full-analysis-title">
      <header className="full-analysis__header">
        <div className="full-analysis__identity">
          <DetailPlayerIdentity player={player} heroNames={heroNames} eyebrow="FULL DETAIL / PLAYER FOCUS" title={`${hero} performance tape`} headingId="full-analysis-title" />
        </div>
        <div className="full-analysis__status" aria-label={`${teamLabel} player status`}>
          <span>{teamLabel} / TELEMETRY</span>
          <strong>LVL {player.level}</strong>
        </div>
      </header>
      <div className="full-analysis__summary">
        <AnalysisMetric label="Impact" value={player.imp === null ? '—' : `${player.imp > 0 ? '+' : ''}${player.imp}`} />
        <AnalysisMetric label="Award" value={formatEnum(player.award ?? 'NONE')} />
        <AnalysisMetric label="Dota Plus" value={player.dotaPlusLevel === null ? '—' : `Level ${player.dotaPlusLevel}`} />
        <AnalysisMetric label="Actions" value={player.totalActions === null ? '—' : formatCompact(player.totalActions)} />
      </div>
      <div className="full-analysis__body">
        <div className="full-analysis__timelines">
          <div className="full-analysis__section-heading">
            <span className="micro-label">PER-MINUTE CURVES</span>
            <span>CUMULATIVE TRACE</span>
          </div>
          <PlayerMinuteCharts
            durationSeconds={durationSeconds}
            levelCapReached={levelCapReached}
            series={player.minuteSeries}
          />
        </div>
        <div className="full-analysis__events">
          <div className="full-analysis__section-heading">
            <span className="micro-label">PLAYER EVENTS</span>
            <span>SELECTED PLAYER</span>
          </div>
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

const MAX_PLAYER_LEVEL = 30;

function hasTrailingZeroTail(values: number[]): boolean {
  let lastPositiveIndex = -1;
  for (const [index, value] of values.entries()) {
    if (value > 0) lastPositiveIndex = index;
  }

  return lastPositiveIndex >= 0
    && values.slice(lastPositiveIndex + 1).every((value) => value === 0);
}

function AnalysisMetric({ label, value }: { label: string; value: string }) {
  return (
    <article className="full-analysis__metric">
      <span className="micro-label">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
