import { useState } from 'react';
import type { MatchDetailPlayer } from '../../lib/match-detail';
import { getPositionIcon } from '../../lib/position-icons';
import {
  buildRoleBreakdown,
  getRoleBreakdownPerformance,
  type RoleBreakdown,
  type RoleBreakdownPeriod,
} from '../../lib/role-breakdown';
import { HeroMark } from '../HeroMark';
import { formatCompact, heroLabel, heroMark } from './match-detail-display';
import { DetailHeading } from './match-detail-primitives';

type RoleBreakdownPanelProps = {
  players: MatchDetailPlayer[];
  heroNames: Record<number, string>;
  selectedPlayerKey: string | null;
};

export function RoleBreakdownPanel({ players, heroNames, selectedPlayerKey }: RoleBreakdownPanelProps) {
  const [focusedPosition, setFocusedPosition] = useState<RoleBreakdown['position'] | null>(null);
  const [period, setPeriod] = useState<RoleBreakdownPeriod>('full');
  const roles = buildRoleBreakdown(players);
  const selectedPosition = roles.find((role) => (
    role.radiantPlayers.some((player) => player.key === selectedPlayerKey)
    || role.direPlayers.some((player) => player.key === selectedPlayerKey)
  ))?.position ?? null;
  const effectiveFocusedPosition = focusedPosition ?? selectedPosition;

  return (
    <section className="detail-panel detail-role-breakdown" aria-labelledby="role-breakdown-title">
      <div className="detail-role-breakdown__header">
        <DetailHeading eyebrow="ROLES / SAME POSITION" title="Role breakdown" id="role-breakdown-title" />
        <div className="role-period-switch" role="group" aria-label="Role breakdown time range">
          <RolePeriodButton period={10} selectedPeriod={period} onSelect={setPeriod}>10:00</RolePeriodButton>
          <RolePeriodButton period={20} selectedPeriod={period} onSelect={setPeriod}>20:00</RolePeriodButton>
          <RolePeriodButton period="full" selectedPeriod={period} onSelect={setPeriod}>Full</RolePeriodButton>
        </div>
      </div>
      <div className="role-breakdown">
        {roles.map((role) => <RoleMatchup
          role={role}
          heroNames={heroNames}
          isFocused={effectiveFocusedPosition === role.position}
          isMuted={effectiveFocusedPosition !== null && effectiveFocusedPosition !== role.position}
          onFocusChange={setFocusedPosition}
          selectedPlayerKey={selectedPlayerKey}
          period={period}
          key={role.position}
        />)}
      </div>
    </section>
  );
}

function RolePeriodButton({
  period,
  selectedPeriod,
  onSelect,
  children,
}: {
  period: RoleBreakdownPeriod;
  selectedPeriod: RoleBreakdownPeriod;
  onSelect: (period: RoleBreakdownPeriod) => void;
  children: string;
}) {
  return <button type="button" aria-pressed={selectedPeriod === period} onClick={() => onSelect(period)}>{children}</button>;
}

function RoleMatchup({
  role,
  heroNames,
  isFocused,
  isMuted,
  onFocusChange,
  selectedPlayerKey,
  period,
}: {
  role: RoleBreakdown;
  heroNames: Record<number, string>;
  isFocused: boolean;
  isMuted: boolean;
  onFocusChange: (position: RoleBreakdown['position'] | null) => void;
  selectedPlayerKey: string | null;
  period: RoleBreakdownPeriod;
}) {
  const icon = getPositionIcon(role.position);
  const selectedPlayer = role.radiantPlayers.find((player) => player.key === selectedPlayerKey)
    ?? role.direPlayers.find((player) => player.key === selectedPlayerKey)
    ?? null;

  return (
    <article
      className={`role-matchup${isFocused ? ' is-focused' : ''}${isMuted ? ' is-muted' : ''}${selectedPlayer ? ' is-player-focused' : ''}`}
      aria-label={`${role.label}: Radiant versus Dire`}
      onPointerEnter={() => onFocusChange(role.position)}
      onPointerLeave={() => onFocusChange(null)}
    >
      <header className="role-matchup__header">
        {icon ? <img src={icon.src} alt="" /> : null}
        <span>{role.label}</span>
      </header>
      <div className="role-matchup__teams">
        <RoleTeam team="radiant" players={role.radiantPlayers} heroNames={heroNames} selectedPlayerKey={selectedPlayerKey} />
        <span className="role-matchup__versus" aria-hidden="true">VS</span>
        <RoleTeam team="dire" players={role.direPlayers} heroNames={heroNames} selectedPlayerKey={selectedPlayerKey} />
      </div>
      <RoleMetrics radiantPlayer={role.radiantPlayers.length === 1 ? role.radiantPlayers[0] : null} direPlayer={role.direPlayers.length === 1 ? role.direPlayers[0] : null} period={period} />
    </article>
  );
}

function RoleMetrics({
  radiantPlayer,
  direPlayer,
  period,
}: {
  radiantPlayer: RoleBreakdown['radiantPlayers'][number] | null;
  direPlayer: RoleBreakdown['direPlayers'][number] | null;
  period: RoleBreakdownPeriod;
}) {
  const radiant = getRoleBreakdownPerformance(radiantPlayer, period);
  const dire = getRoleBreakdownPerformance(direPlayer, period);
  const metrics: Array<{
    label: string;
    radiant: number | null;
    dire: number | null;
    format: (value: number) => string;
    higherIsBetter?: boolean;
  }> = [
    {
      label: 'KDA',
      radiant: kda(radiant),
      dire: kda(dire),
      format: (value) => value.toFixed(1),
    },
    { label: 'Kills', radiant: radiant?.kills ?? null, dire: dire?.kills ?? null, format: String },
    { label: 'Deaths', radiant: radiant?.deaths ?? null, dire: dire?.deaths ?? null, format: String, higherIsBetter: false },
    { label: 'Assists', radiant: radiant?.assists ?? null, dire: dire?.assists ?? null, format: String },
    { label: 'Net worth', radiant: radiant?.netWorth ?? null, dire: dire?.netWorth ?? null, format: formatCompact },
    { label: period === 'full' ? 'Experience/min' : 'Experience', radiant: radiant?.experience ?? null, dire: dire?.experience ?? null, format: formatCompact },
    { label: 'Last hits', radiant: radiant?.lastHits ?? null, dire: dire?.lastHits ?? null, format: String },
    { label: 'Denies', radiant: radiant?.denies ?? null, dire: dire?.denies ?? null, format: String },
  ];

  return (
    <dl className="role-matchup__metrics">
      {metrics.map((metric) => <div className="role-metric" key={metric.label}>
        <dd className={`role-metric__value role-metric__value--radiant${isLeading(metric.radiant, metric.dire, metric.higherIsBetter) ? ' is-leading' : ''}`}>{metric.radiant === null ? '—' : metric.format(metric.radiant)}</dd>
        <dt>{metric.label}</dt>
        <dd className={`role-metric__value role-metric__value--dire${isLeading(metric.dire, metric.radiant, metric.higherIsBetter) ? ' is-leading' : ''}`}>{metric.dire === null ? '—' : metric.format(metric.dire)}</dd>
        <div className="role-metric__track" aria-hidden="true">
          <span className="role-metric__track-value role-metric__track-value--radiant" style={metricTrackStyle(metric.radiant, metric.dire, 'radiant')} />
          <span className="role-metric__track-value role-metric__track-value--dire" style={metricTrackStyle(metric.radiant, metric.dire, 'dire')} />
        </div>
      </div>)}
    </dl>
  );
}

function kda(performance: ReturnType<typeof getRoleBreakdownPerformance>): number | null {
  if (performance === null || performance.kills === null || performance.deaths === null || performance.assists === null) {
    return null;
  }
  return (performance.kills + performance.assists) / Math.max(performance.deaths, 1);
}

function isLeading(value: number | null, opponentValue: number | null, higherIsBetter = true): boolean {
  if (value === null || opponentValue === null) return false;
  return higherIsBetter ? value > opponentValue : value < opponentValue;
}

function metricTrackStyle(radiant: number | null, dire: number | null, team: 'radiant' | 'dire'): { width: string } | undefined {
  if (radiant === null || dire === null) return undefined;

  const total = radiant + dire;
  if (total <= 0) return { width: '50%' };

  const value = team === 'radiant' ? radiant : dire;
  return { width: `${Math.max(4, value / total * 100)}%` };
}

function RoleTeam({
  team,
  players,
  heroNames,
  selectedPlayerKey,
}: {
  team: 'radiant' | 'dire';
  players: RoleBreakdown['radiantPlayers'];
  heroNames: Record<number, string>;
  selectedPlayerKey: string | null;
}) {
  if (players.length === 0) {
    return <span className={`role-matchup__missing role-matchup__missing--${team}`}>Unavailable</span>;
  }

  return (
    <div className={`role-matchup__team role-matchup__team--${team}`}>
      {players.map((player) => {
        const hero = heroLabel(player.heroId, heroNames);
        return (
          <div className={`role-matchup__player${player.key === selectedPlayerKey ? ' is-selected' : ''}`} key={player.key}>
            <HeroMark heroId={player.heroId} label={hero} fallback={heroMark(player.heroId, heroNames)} className="role-matchup__hero" />
            <strong>{hero}</strong>
          </div>
        );
      })}
    </div>
  );
}
