import type { MatchDetailPlayer, MatchDetailSnapshot } from '../../lib/match-detail';
import { buildLaneAnalysis, LANE_ANALYSIS_MINUTE, type LaneAnalysis } from '../../lib/lane-analysis';
import { getPositionIcon, getPositionLabel } from '../../lib/position-icons';
import { useTranslation, type TranslationKey } from '../../lib/i18n';
import { HeroMark } from '../HeroMark';
import { formatCompact, formatEnum, heroLabel, heroMark } from './match-detail-display';
import { DetailHeading } from './match-detail-primitives';

type LaneAnalysisPanelProps = {
  players: MatchDetailPlayer[];
  heroNames: Record<number, string>;
  laneOutcomes: MatchDetailSnapshot['laneOutcomes'];
  eventCounts: MatchDetailSnapshot['eventCounts'];
};

export function LaneAnalysisPanel({ players, heroNames, laneOutcomes, eventCounts }: LaneAnalysisPanelProps) {
  const { t } = useTranslation();
  const lanes = buildLaneAnalysis(players, laneOutcomes);

  return (
    <section className="detail-panel detail-lanes" aria-labelledby="lanes-title">
      <DetailHeading eyebrow={t('laneAnalysisEyebrow')} title={t('laneAnalysisTitle')} id="lanes-title" />
      <div className="lane-analysis">
        {lanes.map((lane) => (
          <article className={`lane-matchup lane-matchup--${laneResult(lane)}`} key={lane.id} aria-label={`${lane.label}: ${laneVerdict(lane, t)}`}>
            <header className="lane-matchup__header">
              <div>
                <span className="micro-label">{lane.label}</span>
                <strong>{laneVerdict(lane, t)}</strong>
              </div>
              <span className={`lane-matchup__source lane-matchup__source--${lane.source}`}>{laneSource(lane, t)}</span>
            </header>
            <div className="lane-matchup__teams">
              <LaneTeam team="radiant" players={lane.radiantPlayers} heroNames={heroNames} />
              <span className="lane-matchup__versus" aria-hidden="true">VS</span>
              <LaneTeam team="dire" players={lane.direPlayers} heroNames={heroNames} />
            </div>
            <div className="lane-matchup__metrics">
              <LaneMetric label={t('laneAnalysisNetWorth')} radiant={lane.radiantNetWorth} dire={lane.direNetWorth} />
              <LaneMetric label={t('laneAnalysisLastHits')} radiant={lane.radiantLastHits} dire={lane.direLastHits} />
            </div>
          </article>
        ))}
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
  );
}

function LaneTeam({
  team,
  players,
  heroNames,
}: {
  team: 'radiant' | 'dire';
  players: LaneAnalysis['radiantPlayers'];
  heroNames: Record<number, string>;
}) {
  const { t } = useTranslation();
  const teamLabel = team === 'radiant' ? t('scoreboardTeamRadiant') : t('scoreboardTeamDire');

  return (
    <div className={`lane-matchup__team lane-matchup__team--${team}`} aria-label={`${teamLabel} lane roles`}>
      <span className="lane-matchup__team-label">{teamLabel}</span>
      <div className="lane-matchup__roles">
        {players.length > 0 ? players.map((player) => <LaneRole player={player} heroNames={heroNames} key={player.key} />) : <span className="lane-matchup__missing">{t('laneAnalysisMissingRole')}</span>}
      </div>
    </div>
  );
}

function LaneRole({ player, heroNames }: { player: LaneAnalysis['radiantPlayers'][number]; heroNames: Record<number, string> }) {
  const icon = player.position === null ? null : getPositionIcon(player.position);
  const role = player.position === null
    ? player.role === null ? 'Unknown role' : formatEnum(player.role)
    : getPositionLabel(player.position);
  const hero = heroLabel(player.heroId, heroNames);

  return (
    <div className="lane-role">
      <HeroMark heroId={player.heroId} label={hero} fallback={heroMark(player.heroId, heroNames)} className="lane-role__hero" />
      <span className="lane-role__copy">
        <strong>{hero}</strong>
        <small>{icon ? <img src={icon.src} alt="" /> : null}{role}</small>
      </span>
    </div>
  );
}

function LaneMetric({ label, radiant, dire }: { label: string; radiant: number | null; dire: number | null }) {
  const gridTemplateColumns = radiant === null || dire === null
    ? undefined
    : `${Math.max(radiant, 1)}fr ${Math.max(dire, 1)}fr`;

  return (
    <div className="lane-metric">
      <header className="lane-metric__header">
        <span>{label}</span>
        <time dateTime={`PT${LANE_ANALYSIS_MINUTE}M`}>{LANE_ANALYSIS_MINUTE}:00</time>
      </header>
      <div className="lane-metric__values">
        <strong className="lane-metric__value lane-metric__value--radiant">{formatLaneMetric(radiant)}</strong>
        <span className="lane-metric__versus">VS</span>
        <strong className="lane-metric__value lane-metric__value--dire">{formatLaneMetric(dire)}</strong>
      </div>
      <div className="lane-metric__track" style={gridTemplateColumns ? { gridTemplateColumns } : undefined} aria-hidden="true">
        <span className="lane-metric__track-value lane-metric__track-value--radiant" />
        <span className="lane-metric__track-value lane-metric__track-value--dire" />
      </div>
    </div>
  );
}

function laneVerdict(lane: LaneAnalysis, t: (key: TranslationKey, replacements?: Record<string, string | number>) => string): string {
  if (lane.source === 'calculated' && lane.netWorthDelta !== null) {
    if (lane.netWorthDelta === 0) return t('laneAnalysisEven');
    const value = formatCompact(Math.abs(lane.netWorthDelta));
    return lane.netWorthDelta > 0
      ? t('laneAnalysisRadiantLead', { value })
      : t('laneAnalysisDireLead', { value });
  }
  if (lane.source === 'provider') return formatEnum(lane.providerOutcome);
  return t('laneAnalysisNoData');
}

function laneSource(lane: LaneAnalysis, t: (key: TranslationKey) => string): string {
  if (lane.source === 'calculated') return t('laneAnalysisCalculatedSource');
  if (lane.source === 'provider') return t('laneAnalysisProviderSource');
  return t('laneAnalysisUnavailableSource');
}

function laneResult(lane: LaneAnalysis): 'radiant' | 'dire' | 'even' | 'unknown' {
  if (lane.source === 'calculated' && lane.netWorthDelta !== null) {
    return lane.netWorthDelta > 0 ? 'radiant' : lane.netWorthDelta < 0 ? 'dire' : 'even';
  }
  if (lane.providerOutcome === 'RADIANT_VICTORY') return 'radiant';
  if (lane.providerOutcome === 'DIRE_VICTORY') return 'dire';
  if (lane.providerOutcome === 'TIE') return 'even';
  return 'unknown';
}

function formatLaneMetric(value: number | null): string {
  return value === null ? 'N/A' : formatCompact(value);
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
