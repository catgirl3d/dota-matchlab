import { useTranslation } from '../../lib/i18n';
import { formatCompact } from './match-detail-display';

export type ScoreboardTeamMetric = {
  label: string;
  radiant: number;
  dire: number;
  format?: 'compact';
  direction?: 'highest' | 'lowest';
  contribution?: {
    team: 'radiant' | 'dire';
    playerLabel: string;
    value: number;
  };
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
  contribution,
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
  const radiantContribution = contribution?.team === 'radiant' ? contribution : null;
  const direContribution = contribution?.team === 'dire' ? contribution : null;
  const contributionTeamTotal = contribution?.team === 'radiant' ? radiant : dire;
  const contributionShare = contribution === undefined || contributionTeamTotal <= 0
    ? null
    : Math.min(100, contribution.value / contributionTeamTotal * 100);
  const contributionValue = contribution === undefined
    ? null
    : format === 'compact' ? formatCompact(contribution.value) : String(contribution.value);

  return (
    <article
      className={`scoreboard-total-card team-comparison-card${leadingTeam ? ` team-comparison-card--${leadingTeam}` : ''}${contribution ? ` has-contribution has-contribution--${contribution.team}` : ''}${focusedMetricId === metricId ? ' is-focused' : ''}${focusedMetricId !== null && focusedMetricId !== metricId ? ' is-muted' : ''}`}
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
        <span className={`scoreboard-total-card__team scoreboard-total-card__team--radiant${radiantContribution ? ' is-contribution' : ''}`}>
          <small>{t('scoreboardTeamRadiant')}</small>
          <strong>{radiantValue}{leadingTeam === 'radiant' && leadingPercentage !== null ? <small className="scoreboard-total-card__percentage">({leadingPercentage}%)</small> : null}</strong>
          {radiantContribution && contributionValue ? <span className="scoreboard-total-card__contribution"><span>{radiantContribution.playerLabel}</span><strong>{contributionValue}</strong></span> : null}
        </span>
        <span className="scoreboard-total-card__versus">VS</span>
        <span className={`scoreboard-total-card__team scoreboard-total-card__team--dire${direContribution ? ' is-contribution' : ''}`}>
          <small>{t('scoreboardTeamDire')}</small>
          <strong>{direValue}{leadingTeam === 'dire' && leadingPercentage !== null ? <small className="scoreboard-total-card__percentage">({leadingPercentage}%)</small> : null}</strong>
          {direContribution && contributionValue ? <span className="scoreboard-total-card__contribution"><span>{direContribution.playerLabel}</span><strong>{contributionValue}</strong></span> : null}
        </span>
      </div>
      <div className="scoreboard-total-card__track" style={{ gridTemplateColumns: trackColumns }} aria-hidden="true">
        <span className={`scoreboard-total-card__track-value scoreboard-total-card__track-value--radiant${radiantContribution ? ' has-contribution' : ''}`}>
          {radiantContribution && contributionShare !== null ? <i className="scoreboard-total-card__contribution-share" style={{ width: `${contributionShare}%` }} /> : null}
        </span>
        <span className={`scoreboard-total-card__track-value scoreboard-total-card__track-value--dire${direContribution ? ' has-contribution' : ''}`}>
          {direContribution && contributionShare !== null ? <i className="scoreboard-total-card__contribution-share" style={{ width: `${contributionShare}%` }} /> : null}
        </span>
      </div>
    </article>
  );
}
