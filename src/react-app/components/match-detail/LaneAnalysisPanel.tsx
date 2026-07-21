import { useState } from 'react';
import type { MatchDetailPlayer, MatchDetailSnapshot } from '../../lib/match-detail';
import { buildLaneAnalysis, getLanePlayerMetrics, LANE_ANALYSIS_MINUTE, type LaneAnalysis } from '../../lib/lane-analysis';
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
  const [focusedLaneId, setFocusedLaneId] = useState<LaneAnalysis['id'] | null>(null);
  const [highlightedPlayerKey, setHighlightedPlayerKey] = useState<string | null>(null);
  const lanes = buildLaneAnalysis(players, laneOutcomes);

  return (
    <section className="detail-panel detail-lanes" aria-labelledby="lanes-title">
      <DetailHeading eyebrow={t('laneAnalysisEyebrow')} title={t('laneAnalysisTitle')} id="lanes-title" />
      <div className="lane-analysis">
        {lanes.map((lane) => <LaneMatchup
          lane={lane}
          heroNames={heroNames}
          isFocused={focusedLaneId === lane.id}
          isMuted={focusedLaneId !== null && focusedLaneId !== lane.id}
          onFocusChange={setFocusedLaneId}
          highlightedPlayerKey={highlightedPlayerKey}
          onHighlight={setHighlightedPlayerKey}
          key={lane.id}
        />)}
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

function LaneMatchup({
  lane,
  heroNames,
  isFocused,
  isMuted,
  onFocusChange,
  highlightedPlayerKey,
  onHighlight,
}: {
  lane: LaneAnalysis;
  heroNames: Record<number, string>;
  isFocused: boolean;
  isMuted: boolean;
  onFocusChange: (laneId: LaneAnalysis['id'] | null) => void;
  highlightedPlayerKey: string | null;
  onHighlight: (playerKey: string | null) => void;
}) {
  const { t } = useTranslation();
  const highlightedPlayer = lane.radiantPlayers.find((player) => player.key === highlightedPlayerKey)
    ?? lane.direPlayers.find((player) => player.key === highlightedPlayerKey)
    ?? null;

  return (
    <article
      className={`lane-matchup lane-matchup--${laneResult(lane)}${isFocused ? ' is-focused' : ''}${highlightedPlayer ? ' is-player-focused' : ''}${isMuted ? ' is-muted' : ''}`}
      aria-label={`${lane.label}: ${laneVerdict(lane, t)}`}
      onPointerEnter={() => onFocusChange(lane.id)}
      onPointerLeave={() => onFocusChange(null)}
    >
      <header className="lane-matchup__header">
        <div>
          <span className="micro-label">{lane.label}</span>
          <strong>{laneVerdict(lane, t)}</strong>
        </div>
        <span className={`lane-matchup__source lane-matchup__source--${lane.source}`}>{laneSource(lane, t)}</span>
      </header>
      <div className="lane-matchup__teams">
        <LaneTeam team="radiant" players={lane.radiantPlayers} heroNames={heroNames} isPlayerFocusedOnLane={highlightedPlayer !== null} highlightedPlayerKey={highlightedPlayerKey} onHighlight={onHighlight} />
        <span className="lane-matchup__versus" aria-hidden="true">VS</span>
        <LaneTeam team="dire" players={lane.direPlayers} heroNames={heroNames} isPlayerFocusedOnLane={highlightedPlayer !== null} highlightedPlayerKey={highlightedPlayerKey} onHighlight={onHighlight} />
      </div>
      <div className="lane-matchup__metrics">
        <LaneMetric label={t('laneAnalysisNetWorth')} metric="netWorth" radiant={lane.radiantNetWorth} dire={lane.direNetWorth} highlightedPlayer={highlightedPlayer} heroNames={heroNames} />
        <LaneMetric label={t('laneAnalysisLastHits')} metric="lastHits" radiant={lane.radiantLastHits} dire={lane.direLastHits} highlightedPlayer={highlightedPlayer} heroNames={heroNames} />
      </div>
    </article>
  );
}

function LaneTeam({
  team,
  players,
  heroNames,
  isPlayerFocusedOnLane,
  highlightedPlayerKey,
  onHighlight,
}: {
  team: 'radiant' | 'dire';
  players: LaneAnalysis['radiantPlayers'];
  heroNames: Record<number, string>;
  isPlayerFocusedOnLane: boolean;
  highlightedPlayerKey: string | null;
  onHighlight: (playerKey: string | null) => void;
}) {
  const { t } = useTranslation();
  const teamLabel = team === 'radiant' ? t('scoreboardTeamRadiant') : t('scoreboardTeamDire');

  return (
    <div className={`lane-matchup__team lane-matchup__team--${team}`} aria-label={`${teamLabel} lane roles`}>
      <span className="lane-matchup__team-label">{teamLabel}</span>
      <div className="lane-matchup__roles">
        {players.length > 0 ? players.map((player) => <LaneRole
          player={player}
          heroNames={heroNames}
          isPlayerFocusedOnLane={isPlayerFocusedOnLane}
          highlightedPlayerKey={highlightedPlayerKey}
          onHighlight={onHighlight}
          key={player.key}
        />) : <span className="lane-matchup__missing">{t('laneAnalysisMissingRole')}</span>}
      </div>
    </div>
  );
}

function LaneRole({
  player,
  heroNames,
  isPlayerFocusedOnLane,
  highlightedPlayerKey,
  onHighlight,
}: {
  player: LaneAnalysis['radiantPlayers'][number];
  heroNames: Record<number, string>;
  isPlayerFocusedOnLane: boolean;
  highlightedPlayerKey: string | null;
  onHighlight: (playerKey: string | null) => void;
}) {
  const { t } = useTranslation();
  const icon = player.position === null ? null : getPositionIcon(player.position);
  const role = player.position === null
    ? player.role === null ? 'Unknown role' : formatEnum(player.role)
    : getPositionLabel(player.position);
  const hero = heroLabel(player.heroId, heroNames);
  const isHighlighted = highlightedPlayerKey === player.key;
  const isMuted = isPlayerFocusedOnLane && !isHighlighted;

  return (
    <div className={`lane-role${isHighlighted ? ' is-highlighted' : ''}${isMuted ? ' is-muted' : ''}`}>
      <button
        className="lane-role__trigger"
        type="button"
        aria-label={`${t('laneAnalysisFocusAriaLabel', { hero })}: ${role}`}
        onPointerEnter={() => onHighlight(player.key)}
        onPointerLeave={() => onHighlight(null)}
        onFocus={() => onHighlight(player.key)}
        onBlur={() => onHighlight(null)}
      >
        <HeroMark heroId={player.heroId} label={hero} fallback={heroMark(player.heroId, heroNames)} className="lane-role__hero" />
      </button>
      <span className="lane-role__copy">
        <strong>{hero}</strong>
        <small>{icon ? <img src={icon.src} alt="" /> : null}{role}</small>
      </span>
    </div>
  );
}

function LaneMetric({
  label,
  metric,
  radiant,
  dire,
  highlightedPlayer,
  heroNames,
}: {
  label: string;
  metric: 'netWorth' | 'lastHits';
  radiant: number | null;
  dire: number | null;
  highlightedPlayer: LaneAnalysis['radiantPlayers'][number] | null;
  heroNames: Record<number, string>;
}) {
  const gridTemplateColumns = radiant === null || dire === null
    ? undefined
    : `${Math.max(radiant, 1)}fr ${Math.max(dire, 1)}fr`;
  const playerMetrics = highlightedPlayer === null ? null : getLanePlayerMetrics(highlightedPlayer);
  const playerValue = playerMetrics?.[metric] ?? null;
  const highlightedTeamValue = highlightedPlayer?.isRadiant ? radiant : dire;
  const playerShare = playerValue === null || highlightedTeamValue === null || highlightedTeamValue <= 0
    ? null
    : Math.min(100, playerValue / highlightedTeamValue * 100);
  const highlightedHero = highlightedPlayer === null ? null : heroLabel(highlightedPlayer.heroId, heroNames);

  return (
    <div className={`lane-metric${highlightedPlayer ? ` is-player-${highlightedPlayer.isRadiant ? 'radiant' : 'dire'}` : ''}`}>
      <header className="lane-metric__header">
        <span>{label}</span>
        <time dateTime={`PT${LANE_ANALYSIS_MINUTE}M`}>{LANE_ANALYSIS_MINUTE}:00</time>
      </header>
      <div className="lane-metric__values">
        <LaneMetricValue team="radiant" value={highlightedPlayer?.isRadiant ? playerValue : radiant} playerLabel={highlightedPlayer?.isRadiant ? highlightedHero : null} />
        <span className="lane-metric__versus">VS</span>
        <LaneMetricValue team="dire" value={highlightedPlayer?.isRadiant === false ? playerValue : dire} playerLabel={highlightedPlayer?.isRadiant === false ? highlightedHero : null} />
      </div>
      <div className="lane-metric__track" style={gridTemplateColumns ? { gridTemplateColumns } : undefined} aria-hidden="true">
        <span className="lane-metric__track-value lane-metric__track-value--radiant">
          {highlightedPlayer?.isRadiant && playerShare !== null ? <i className="lane-metric__player-share lane-metric__player-share--radiant" style={{ width: `${playerShare}%` }} key={highlightedPlayer.key} /> : null}
        </span>
        <span className="lane-metric__track-value lane-metric__track-value--dire">
          {highlightedPlayer?.isRadiant === false && playerShare !== null ? <i className="lane-metric__player-share lane-metric__player-share--dire" style={{ width: `${playerShare}%` }} key={highlightedPlayer.key} /> : null}
        </span>
      </div>
    </div>
  );
}

function LaneMetricValue({
  team,
  value,
  playerLabel,
}: {
  team: 'radiant' | 'dire';
  value: number | null;
  playerLabel: string | null;
}) {
  return (
    <span className={`lane-metric__value lane-metric__value--${team}${playerLabel ? ' is-player' : ''}`}>
      {playerLabel ? <small>{playerLabel}</small> : null}
      <strong>{formatLaneMetric(value)}</strong>
    </span>
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
