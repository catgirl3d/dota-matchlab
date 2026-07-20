import type { MatchDetailPlayer } from '../../lib/match-detail';
import type { PlayerSort } from '../PlayerSortControls';

export function sortPlayers(players: MatchDetailPlayer[], sort: PlayerSort): MatchDetailPlayer[] {
  return [...players].sort((left, right) => {
    if (sort === 'slot') {
      return left.playerSlot - right.playerSlot;
    }

    const leftValue = playerSortValue(left, sort);
    const rightValue = playerSortValue(right, sort);
    if (leftValue === null && rightValue !== null) {
      return 1;
    }
    if (leftValue !== null && rightValue === null) {
      return -1;
    }
    if (leftValue !== null && rightValue !== null && leftValue !== rightValue) {
      return rightValue - leftValue;
    }
    return left.playerSlot - right.playerSlot;
  });
}

function playerSortValue(player: MatchDetailPlayer, sort: Exclude<PlayerSort, 'slot'>): number | null {
  if (sort === 'imp') {
    return player.imp;
  }
  if (sort === 'heroDamage') {
    return player.heroDamage;
  }
  return player.towerDamage;
}
