import { getPositionLabel } from '../../lib/position-icons';
import type { MatchDetailPlayer } from '../../lib/match-detail';
import { HeroMark } from '../HeroMark';
import { heroLabel, heroMark } from './match-detail-display';
import { DetailHeading } from './match-detail-primitives';

type DetailPlayerIdentityProps = {
  player: MatchDetailPlayer;
  heroNames: Record<number, string>;
  eyebrow: string;
  title: string;
  headingId: string;
};

export function DetailPlayerIdentity({ player, heroNames, eyebrow, title, headingId }: DetailPlayerIdentityProps) {
  const hero = heroLabel(player.heroId, heroNames);
  const playerLabel = player.name ?? (player.accountId === null ? 'Unknown player' : `Player #${player.accountId}`);
  const role = player.position === null ? 'Unknown role' : getPositionLabel(player.position);

  return (
    <div className="detail-player-identity">
      <HeroMark heroId={player.heroId} label={hero} fallback={heroMark(player.heroId, heroNames)} className="detail-player-portrait" />
      <div className="detail-player-identity__copy">
        <DetailHeading eyebrow={eyebrow} title={title} id={headingId} />
        <span>{playerLabel} · {role}</span>
      </div>
    </div>
  );
}
