import { useState } from 'react';
import type { MatchDetailPlayer, MatchTimelineEvent } from '../../lib/match-detail';
import { calculatePlayerResponsibility, calculateTeamOutputShare, OBJECTIVE_EXPOSURE_WINDOW_SECONDS, type ContributionDimensionId, type LiabilityDimensionId, type PlayerResponsibilityResult, type TeamOutputComponentId, type TeamOutputShareResult } from '../../lib/player-contribution';
import { FilterDropdown } from '../FilterDropdown';
import { getPositionLabel } from '../../lib/position-icons';
import { HeroMark } from '../HeroMark';
import { Tooltip } from '../Tooltip';
import { heroLabel, heroMark } from './match-detail-display';
import { DetailHeading } from './match-detail-primitives';

type PlayerContributionPanelProps = {
  player: MatchDetailPlayer;
  players: MatchDetailPlayer[];
  heroNames: Record<number, string>;
  hasDetailedEvents: boolean;
  events: MatchTimelineEvent[];
  durationSeconds: number | null;
  onPlayerSelect: (playerKey: string) => void;
};

type ContributionViewMode = 'opponent-benchmark' | 'team-output';
type HeroSideFilter = 'all' | 'radiant' | 'dire';

const DIMENSIONS: Record<ContributionDimensionId, { label: string; detail: string; help: string }> = {
  fight: { label: 'Fight', detail: 'Kill participation / damage efficiency / survival', help: 'Fight impact versus the same-role opponent.' },
  lane: { label: 'Lane', detail: '10-minute net worth / last hits', help: 'Lane farm at 10 minutes versus the same role.' },
  economy: { label: 'Economy', detail: 'GPM / XPM / final net worth', help: 'Resource growth versus the same-role opponent.' },
  objectives: { label: 'Objectives', detail: 'Tower damage', help: 'Tower damage versus the same-role opponent.' },
  utility: { label: 'Utility', detail: 'Assists / healing / vision / runes', help: 'Support actions versus the same-role opponent.' },
};

const LIABILITY_DIMENSIONS: Record<LiabilityDimensionId, { label: string; help: string }> = {
  'death-cost': { label: 'Death cost', help: 'Deaths weighted by timing, trades and resources.' },
  'fight-absence': { label: 'Fight absence', help: 'Eligible team fights the player missed.' },
  'resource-conversion-gap': { label: 'Resource conversion gap', help: 'Net worth share above measurable team output.' },
  'objective-exposure': { label: 'Objective exposure', help: 'Deaths followed by a loss of your tower.' },
};

const TEAM_OUTPUT_COMPONENTS: Record<TeamOutputComponentId, { label: string; help: string }> = {
  'fight-involvement': { label: 'Fight involvement', help: 'Share of team kills and assists.' },
  'hero-damage': { label: 'Hero damage', help: 'Share of all team hero damage.' },
  'tower-damage': { label: 'Tower damage', help: 'Share of all team tower damage.' },
  'hero-healing': { label: 'Hero healing', help: 'Share of all team hero healing.' },
};

export function PlayerContributionPanel({ player, players, heroNames, hasDetailedEvents, events, durationSeconds, onPlayerSelect }: PlayerContributionPanelProps) {
  const [viewMode, setViewMode] = useState<ContributionViewMode>('opponent-benchmark');
  const [heroSideFilter, setHeroSideFilter] = useState<HeroSideFilter>('all');
  const result = calculatePlayerResponsibility(players, player.key, events, durationSeconds, { hasDetailedEvents });
  const teamOutput = calculateTeamOutputShare(players, player.key);
  const isTeamOutput = viewMode === 'team-output';
  const hero = heroLabel(player.heroId, heroNames);
  const playerLabel = player.name ?? (player.accountId === null ? 'Unknown player' : `Player #${player.accountId}`);

  return (
    <section className="detail-panel player-contribution" aria-labelledby="player-contribution-title">
      <header className="player-contribution__header">
        <div className="player-contribution__identity">
          <HeroMark heroId={player.heroId} label={hero} fallback={heroMark(player.heroId, heroNames)} className="player-contribution__hero" />
          <div>
            <DetailHeading eyebrow={isTeamOutput ? 'PLAYER FILTER / OWN TEAM' : 'PLAYER FILTER / ROLE-ADJUSTED'} title={isTeamOutput ? `${hero} team output share` : `${hero} contribution index`} id="player-contribution-title" />
            <span>{playerLabel} · {roleLabel(player)}</span>
          </div>
          <div className="player-contribution__player-select">
            <HeroSideSwitch value={heroSideFilter} onChange={setHeroSideFilter} />
            <FilterDropdown label="Hero" value={player.key} selectedLabel={hero} options={heroOptions(players, heroNames, heroSideFilter)} searchable onChange={onPlayerSelect} />
          </div>
        </div>
        {isTeamOutput && teamOutput ? (
          <div className="player-contribution__summary">
            <SummaryScore label="Team output share" help="Share of measurable positive team output; 20% is equal share." value={teamOutput.score} suffix="% OF TEAM" tone={teamShareTone(teamOutput.score, teamOutput.equalShare)} ariaLabel={`Team output share ${teamOutput.score} percent`} />
            <SummaryScore label="Vs equal share" help="Difference from the 20% equal-share baseline." value={teamOutput.score - teamOutput.equalShare} suffix="PP" tone={teamShareTone(teamOutput.score, teamOutput.equalShare)} ariaLabel={`Difference from equal team share ${signed(teamOutput.score - teamOutput.equalShare)} percentage points`} signedValue />
            {result ? <SummaryScore label={`Liability · ${liabilityLevel(result.liability.score)}`} help="Higher means more observed burden on the team." value={result.liability.score} suffix="/ 100" tone={liabilityTone(result.liability.score)} ariaLabel={`Liability index ${result.liability.score} out of 100, ${liabilityLevel(result.liability.score).toLowerCase()}`} /> : null}
          </div>
        ) : !isTeamOutput && result ? (
          <div className="player-contribution__summary">
            <SummaryScore label="Contribution" help="Role-adjusted comparison to the same-role opponent; 50 is parity." value={result.contribution.score} suffix="/ 100" tone={scoreTone(result.contribution.score)} ariaLabel={`Contribution index ${result.contribution.score} out of 100`} />
            <SummaryScore label={`Liability · ${liabilityLevel(result.liability.score)}`} help="Higher means more observed burden on the team." value={result.liability.score} suffix="/ 100" tone={liabilityTone(result.liability.score)} ariaLabel={`Liability index ${result.liability.score} out of 100, ${liabilityLevel(result.liability.score).toLowerCase()}`} />
            <SummaryScore label="Balance" help="Contribution minus Liability." value={result.balance} suffix="NET" tone={balanceTone(result.balance)} ariaLabel={`Responsibility balance ${signed(result.balance)}`} signedValue />
          </div>
        ) : null}
      </header>

      <ContributionModeSwitch value={viewMode} onChange={setViewMode} teamOutputAvailable={teamOutput !== null} />

      {isTeamOutput && teamOutput ? (
        <>
          <TeamOutputDimensions player={player} result={teamOutput} />
          {result ? <LiabilitySection result={result} /> : null}
          <footer className="player-contribution__footer">
            <span>Five-player team total: 100% · Equal share: {teamOutput.equalShare}%</span>
            <span>Positive measured output only · Deaths are evaluated separately in Liability</span>
          </footer>
        </>
      ) : !isTeamOutput && result ? (
        <>
          <OpponentContributionDimensions result={result} />
          <LiabilitySection result={result} />
          <footer className="player-contribution__footer">
            <span>Contribution {benchmarkLabel(result.contribution.benchmark.kind, result.contribution.benchmark.playerKey, players)}</span>
            <span>Client estimate · IMP excluded · {result.contribution.confidence.toUpperCase()} confidence · Contribution 50 = parity · Liability 0 = none</span>
          </footer>
        </>
      ) : (
        <p className="player-contribution__empty">{isTeamOutput ? 'A complete five-player team is required to calculate team output share.' : 'An opposing roster is required to calculate this index.'}</p>
      )}
    </section>
  );
}

function heroOptions(players: readonly MatchDetailPlayer[], heroNames: Record<number, string>, sideFilter: HeroSideFilter): Array<readonly [string, string]> {
  return players
    .filter((candidate) => sideFilter === 'all' || candidate.isRadiant === (sideFilter === 'radiant'))
    .map((candidate) => [candidate.key, heroLabel(candidate.heroId, heroNames)] as const);
}

function HeroSideSwitch({ value, onChange }: { value: HeroSideFilter; onChange: (value: HeroSideFilter) => void }) {
  return (
    <div className="player-contribution__hero-side-switch" role="group" aria-label="Hero side">
      <button type="button" className={value === 'all' ? 'is-active' : ''} aria-pressed={value === 'all'} onClick={() => onChange('all')}>All</button>
      <button type="button" className={value === 'radiant' ? 'is-active' : ''} aria-pressed={value === 'radiant'} onClick={() => onChange('radiant')}>Radiant</button>
      <button type="button" className={value === 'dire' ? 'is-active' : ''} aria-pressed={value === 'dire'} onClick={() => onChange('dire')}>Dire</button>
    </div>
  );
}

function ContributionModeSwitch({ value, onChange, teamOutputAvailable }: { value: ContributionViewMode; onChange: (value: ContributionViewMode) => void; teamOutputAvailable: boolean }) {
  return (
    <div className="player-contribution__mode-switch" role="group" aria-label="Contribution mode">
      <span className="micro-label">MODE</span>
      <div>
        <button type="button" className={value === 'opponent-benchmark' ? 'is-active' : ''} aria-pressed={value === 'opponent-benchmark'} onClick={() => onChange('opponent-benchmark')}>Opponent benchmark</button>
        <button type="button" className={value === 'team-output' ? 'is-active' : ''} aria-pressed={value === 'team-output'} disabled={!teamOutputAvailable} title={teamOutputAvailable ? undefined : 'Requires a complete five-player team'} onClick={() => onChange('team-output')}>Team output share</button>
      </div>
      <small>{teamOutputAvailable ? 'Five teammates total 100%' : 'Requires a complete five-player team'}</small>
    </div>
  );
}

function OpponentContributionDimensions({ result }: { result: PlayerResponsibilityResult }) {
  return (
    <div className="player-contribution__dimensions">
      {result.contribution.dimensions.map((dimension) => {
        const copy = DIMENSIONS[dimension.id];
        return (
          <article className="player-contribution__dimension" aria-label={`${copy.label}: ${dimension.score} out of 100`} key={dimension.id}>
            <header><MetricLabel label={copy.label} help={copy.help} /><strong>{dimension.score}</strong></header>
            <p>{copy.detail}</p>
            <div className="player-contribution__track" aria-hidden="true"><span style={{ width: `${dimension.score}%` }} /></div>
            <small>Weight: {dimension.weight}%</small>
          </article>
        );
      })}
    </div>
  );
}

function TeamOutputDimensions({ player, result }: { player: MatchDetailPlayer; result: TeamOutputShareResult }) {
  return (
    <div className="player-contribution__dimensions is-team-output">
      {result.components.map((component) => {
        const copy = TEAM_OUTPUT_COMPONENTS[component.id];
        return (
          <article className="player-contribution__dimension" aria-label={`${copy.label}: ${component.score} percent of team`} key={component.id}>
            <header><MetricLabel label={copy.label} help={copy.help} /><strong>{component.score}%</strong></header>
            <p>{teamOutputMetricValue(component.id, player)}</p>
            <div className="player-contribution__track" aria-hidden="true"><span style={{ width: `${component.score}%` }} /></div>
            <small>Weight: {component.weight}% · Adds {component.points} pp</small>
          </article>
        );
      })}
    </div>
  );
}

function teamOutputMetricValue(id: TeamOutputComponentId, player: MatchDetailPlayer): string {
  if (id === 'fight-involvement') return `${player.kills} K · ${player.assists} A`;
  if (id === 'hero-damage') return `${compactMetricValue(player.heroDamage)} DMG`;
  if (id === 'tower-damage') return `${compactMetricValue(player.towerDamage)} TOWER`;
  return `${compactMetricValue(player.heroHealing)} HEAL`;
}

function compactMetricValue(value: number): string {
  if (value < 1_000) return String(value);
  const compactValue = value / 1_000;
  return `${compactValue >= 10 ? Math.round(compactValue) : Math.round(compactValue * 10) / 10}K`;
}

function LiabilitySection({ result }: { result: PlayerResponsibilityResult }) {
  return (
    <div className="player-contribution__liability">
      <header><span>RESPONSIBILITY / LIABILITY SIGNALS</span><small>Higher score means greater team burden</small></header>
      <div>
        {result.liability.dimensions.map((dimension) => (
          <article className="player-contribution__liability-card" aria-label={`${LIABILITY_DIMENSIONS[dimension.id].label}: ${dimension.score} out of 100`} key={dimension.id}>
            <header>
              <MetricLabel label={LIABILITY_DIMENSIONS[dimension.id].label} help={LIABILITY_DIMENSIONS[dimension.id].help} />
              <div><em className={`is-${liabilityLevel(dimension.score).toLowerCase()}`}>{liabilityLevel(dimension.score)}</em><strong>{dimension.score}</strong></div>
            </header>
            <p>{liabilityDetail(dimension.id, result)}</p>
            <div className="player-contribution__track is-liability" aria-hidden="true"><span style={{ width: `${dimension.score}%` }} /></div>
            <small>Liability weight: {dimension.weight}%</small>
          </article>
        ))}
      </div>
    </div>
  );
}

function SummaryScore({ label, help, value, suffix, tone, ariaLabel, signedValue = false }: { label: string; help: string; value: number; suffix: string; tone: 'positive' | 'neutral' | 'negative'; ariaLabel: string; signedValue?: boolean }) {
  return (
    <div className={`player-contribution__score is-${tone}`} aria-label={ariaLabel}>
      <strong>{signedValue ? signed(value) : value}</strong>
      <span>{suffix}</span>
      <small><MetricLabel label={label} help={help} /></small>
    </div>
  );
}

function MetricLabel({ label, help }: { label: string; help: string }) {
  return (
    <span className="player-contribution__metric-label">
      {label}
      <Tooltip content={help} ariaLabel={`Explain ${label}`} className="player-contribution__metric-help"><span aria-hidden="true">?</span></Tooltip>
    </span>
  );
}

function roleLabel(player: MatchDetailPlayer): string {
  return player.position === null ? 'Unknown role' : getPositionLabel(player.position);
}

function scoreTone(score: number): 'positive' | 'neutral' | 'negative' {
  if (score >= 65) return 'positive';
  if (score <= 35) return 'negative';
  return 'neutral';
}

function teamShareTone(score: number, equalShare: number): 'positive' | 'neutral' | 'negative' {
  if (score >= equalShare + 5) return 'positive';
  if (score <= equalShare - 5) return 'negative';
  return 'neutral';
}

function liabilityTone(score: number): 'positive' | 'neutral' | 'negative' {
  if (score >= 65) return 'negative';
  if (score <= 35) return 'positive';
  return 'neutral';
}

function liabilityLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score <= 35) return 'LOW';
  if (score >= 65) return 'HIGH';
  return 'MEDIUM';
}

function balanceTone(balance: number): 'positive' | 'neutral' | 'negative' {
  if (balance >= 10) return 'positive';
  if (balance <= -10) return 'negative';
  return 'neutral';
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function liabilityDetail(id: LiabilityDimensionId, result: PlayerResponsibilityResult): string {
  const metrics = result.metrics;
  if (id === 'death-cost') {
    return `${metrics.deaths} deaths · ${metric(metrics.untradedDeaths)} untraded · ${metric(metrics.chainDeaths)} chained · ${metric(metrics.lateDeaths)} late`;
  }
  if (id === 'fight-absence') {
    return `${metric(metrics.participatedFights)}/${metric(metrics.eligibleFights)} fights · ${metric(metrics.missedFights)} missed · ${metric(metrics.objectiveTradeFights)} objective trades · ${metric(metrics.rawAbsence)}% raw / ${metric(metrics.adjustedAbsence)}% adjusted · Benchmark: ${metric(metrics.benchmarkRawAbsence)}% raw / ${metric(metrics.benchmarkAdjustedAbsence)}% adjusted · ${metrics.killParticipation}% aggregate KP`;
  }
  if (id === 'resource-conversion-gap') return `${metrics.resourceShare}% team resources · ${metrics.outputShare}% measurable team output · ${metrics.resourceConversionGap} pp gap`;
  return `${metric(metrics.objectiveExposureDeaths)} linked deaths · ${metric(metrics.objectiveExposureWeight)} weighted exposure with ${OBJECTIVE_EXPOSURE_WINDOW_SECONDS}s decay`;
}

function metric(value: number | null): string {
  return value === null ? '—' : String(value);
}

function benchmarkLabel(
  kind: 'position-opponent' | 'opposing-team-average',
  playerKey: string | null,
  players: MatchDetailPlayer[],
): string {
  if (kind === 'opposing-team-average') return 'Benchmark: opposing team average';
  const opponent = players.find((player) => player.key === playerKey);
  const opponentLabel = opponent?.name ?? (opponent?.accountId === null || opponent === undefined ? 'direct position opponent' : `Player #${opponent.accountId}`);
  return `Benchmark: ${opponentLabel}`;
}
