import { useTranslation } from '../../lib/i18n';
import { formatCompact } from './match-detail-display';

export type ScoreboardTeamMetric = {
  label: string;
  radiant: number;
  dire: number;
  format?: 'compact';
  direction?: 'highest' | 'lowest';
};

type ScoreboardTeamMetricCardProps = ScoreboardTeamMetric & {
  group: string;
  metricId: string;
  focusedMetricId: string | null;
  onFocusChange: (metricId: string | null) => void;
};

export function ScoreboardTeamMetricCard({
  group,
  label,
  radiant,
  dire,
  format,
  direction = 'highest',
  metricId,
  focusedMetricId,
  onFocusChange,
}: ScoreboardTeamMetricCardProps) {
  const trackColumns = `${Math.max(radiant, 1)}fr ${Math.max(dire, 1)}fr`;
  const { t } = useTranslation();
  const radiantValue = format === 'compact' ? formatCompact(radiant) : String(radiant);
  const direValue = format === 'compact' ? formatCompact(dire) : String(dire);
  const radiantLeads = direction === 'highest' ? radiant > dire : radiant < dire;
  const leadingTeam = radiant === dire ? null : radiantLeads ? 'radiant' : 'dire';
  const leadingPercentage = leadingTeam === null || radiant + dire <= 0
    ? null
    : Math.round((leadingTeam === 'radiant' ? radiant : dire) / (radiant + dire) * 100);

  return (
    <article
      className={`scoreboard-total-card team-comparison-card${leadingTeam ? ` team-comparison-card--${leadingTeam}` : ''}${focusedMetricId === metricId ? ' is-focused' : ''}${focusedMetricId !== null && focusedMetricId !== metricId ? ' is-muted' : ''}`}
      aria-label={`${group} ${label} comparison`}
      tabIndex={0}
      onPointerEnter={() => onFocusChange(metricId)}
      onPointerLeave={() => onFocusChange(null)}
      onFocus={() => onFocusChange(metricId)}
      onBlur={() => onFocusChange(null)}
    >
      <header>
        <span>{group} / {label}</span>
        <small>{t('scoreboardTeamTotalsPreview')}</small>
      </header>
      <div className="scoreboard-total-card__values">
        <span className="scoreboard-total-card__team scoreboard-total-card__team--radiant">
          <small>{t('scoreboardTeamRadiant')}</small>
          <strong>{radiantValue}{leadingTeam === 'radiant' && leadingPercentage !== null ? <small className="scoreboard-total-card__percentage">({leadingPercentage}%)</small> : null}</strong>
        </span>
        <span className="scoreboard-total-card__versus">VS</span>
        <span className="scoreboard-total-card__team scoreboard-total-card__team--dire">
          <small>{t('scoreboardTeamDire')}</small>
          <strong>{direValue}{leadingTeam === 'dire' && leadingPercentage !== null ? <small className="scoreboard-total-card__percentage">({leadingPercentage}%)</small> : null}</strong>
        </span>
      </div>
      <div className="scoreboard-total-card__track" style={{ gridTemplateColumns: trackColumns }} aria-hidden="true">
        <span className="scoreboard-total-card__track-value scoreboard-total-card__track-value--radiant" />
        <span className="scoreboard-total-card__track-value scoreboard-total-card__track-value--dire" />
      </div>
    </article>
  );
}
