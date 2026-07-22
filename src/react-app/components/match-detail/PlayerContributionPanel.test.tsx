import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchDetailPlayer } from '../../lib/match-detail';
import { render } from '../../test/setup';
import { PlayerContributionPanel } from './PlayerContributionPanel';

afterEach(cleanup);

describe('PlayerContributionPanel', () => {
  it('switches between the existing opponent index and own-team output share', () => {
    const players = completePlayers();
    render(<PlayerContributionPanel player={players[0]} players={players} heroNames={HERO_NAMES} hasDetailedEvents={false} events={[]} durationSeconds={2_400} onPlayerSelect={vi.fn()} />);

    const modeSwitch = screen.getByRole('group', { name: 'Contribution mode' });
    const opponentMode = within(modeSwitch).getByRole('button', { name: 'Opponent benchmark' });
    const teamMode = within(modeSwitch).getByRole('button', { name: 'Team output share' });

    expect(opponentMode).toHaveAttribute('aria-pressed', 'true');
    expect(teamMode).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Anti-Mage contribution index' })).toBeVisible();
    expect(screen.getByLabelText(/Responsibility balance/)).toBeVisible();

    fireEvent.click(teamMode);

    expect(teamMode).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Anti-Mage team output share' })).toBeVisible();
    expect(screen.getByLabelText('Team output share 20 percent')).toBeVisible();
    expect(screen.queryByLabelText(/Responsibility balance/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Fight involvement: 20 percent of team')).toBeVisible();
    expect(screen.getByLabelText('Hero damage: 20 percent of team')).toBeVisible();
    expect(screen.getByText('5 K · 8 A')).toBeVisible();
    expect(screen.getByText('15K DMG')).toBeVisible();
    expect(screen.getByText('1K TOWER')).toBeVisible();
    expect(screen.getByText('500 HEAL')).toBeVisible();
    expect(screen.getByText('Five-player team total: 100% · Equal share: 20%')).toBeVisible();
    expect(screen.getByText('Positive measured output only · Deaths are evaluated separately in Liability')).toBeVisible();

    fireEvent.click(opponentMode);

    expect(screen.getByRole('heading', { name: 'Anti-Mage contribution index' })).toBeVisible();
    expect(screen.getByLabelText(/Responsibility balance/)).toBeVisible();
  });

  it('disables team output mode for an incomplete team', () => {
    const players = completePlayers().filter((_, index) => index === 0 || index === 5);
    render(<PlayerContributionPanel player={players[0]} players={players} heroNames={HERO_NAMES} hasDetailedEvents={false} events={[]} durationSeconds={2_400} onPlayerSelect={vi.fn()} />);

    const teamMode = screen.getByRole('button', { name: 'Team output share' });
    expect(teamMode).toBeDisabled();
    expect(teamMode).toHaveAttribute('title', 'Requires a complete five-player team');
  });

  it('exposes current-match heroes and delegates hero selection', () => {
    const players = completePlayers();
    const onPlayerSelect = vi.fn();
    render(<PlayerContributionPanel player={players[0]} players={players} heroNames={HERO_NAMES} hasDetailedEvents={false} events={[]} durationSeconds={2_400} onPlayerSelect={onPlayerSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Hero: Anti-Mage' }));
    const heroOptions = screen.getByRole('group', { name: 'Hero options' });
    fireEvent.click(within(heroOptions).getByRole('button', { name: 'Axe' }));

    expect(onPlayerSelect).toHaveBeenCalledWith('player-1');
  });

  it('filters hero choices by team side without clearing the selected hero', () => {
    const players = completePlayers();
    render(<PlayerContributionPanel player={players[0]} players={players} heroNames={HERO_NAMES} hasDetailedEvents={false} events={[]} durationSeconds={2_400} onPlayerSelect={vi.fn()} />);

    const sideSwitch = screen.getByRole('group', { name: 'Hero side' });
    fireEvent.click(within(sideSwitch).getByRole('button', { name: 'Radiant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hero: Anti-Mage' }));
    const heroOptions = screen.getByRole('group', { name: 'Hero options' });

    expect(within(sideSwitch).getByRole('button', { name: 'Radiant' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(heroOptions).getByRole('button', { name: 'Crystal Maiden' })).toBeVisible();
    expect(within(heroOptions).queryByRole('button', { name: 'Drow Ranger' })).not.toBeInTheDocument();

    fireEvent.click(within(sideSwitch).getByRole('button', { name: 'Dire' }));

    expect(screen.getByRole('button', { name: 'Hero: Anti-Mage' })).toBeVisible();
    expect(within(heroOptions).getByRole('button', { name: 'Drow Ranger' })).toBeVisible();
    expect(within(heroOptions).queryByRole('button', { name: 'Crystal Maiden' })).not.toBeInTheDocument();
  });

  it('shows concise metric help from question-mark controls', () => {
    const players = completePlayers();
    render(<PlayerContributionPanel player={players[0]} players={players} heroNames={HERO_NAMES} hasDetailedEvents={false} events={[]} durationSeconds={2_400} onPlayerSelect={vi.fn()} />);

    fireEvent.pointerEnter(screen.getByLabelText('Explain Contribution'));

    expect(screen.getByRole('tooltip')).toHaveTextContent('Role-adjusted comparison to the same-role opponent; 50 is parity.');
  });
});

const HERO_NAMES = { 1: 'Anti-Mage', 2: 'Axe', 3: 'Bane', 4: 'Lina', 5: 'Crystal Maiden', 6: 'Drow Ranger', 7: 'Earthshaker', 8: 'Faceless Void', 9: 'Gyrocopter', 10: 'Huskar' };

function completePlayers(): MatchDetailPlayer[] {
  const positions = [1, 2, 3, 4, 5] as const;
  return Array.from({ length: 10 }, (_, index) => player({
    key: `player-${index}`,
    accountId: index + 1,
    playerSlot: index < 5 ? index : 128 + index - 5,
    isRadiant: index < 5,
    name: index === 0 ? 'Selected' : `Player ${index + 1}`,
    heroId: index + 1,
    position: positions[index % 5],
  }));
}

function player(overrides: Partial<MatchDetailPlayer>): MatchDetailPlayer {
  return {
    key: 'player', accountId: null, playerSlot: 0, isRadiant: true, name: null, heroId: 1,
    kills: 5, deaths: 5, assists: 8, goldPerMinute: 500, xpPerMinute: 550, lastHits: 100, denies: 5,
    heroDamage: 15_000, towerDamage: 1_000, heroHealing: 500, netWorth: 15_000, level: 20, imp: null,
    role: null, position: null, lane: null, award: null, itemIds: [], backpackItemIds: [], neutralItemId: null,
    permanentUpgradeItemIds: { scepterItemId: null, shardItemId: null, moonShardItemId: null },
    abilityBuild: [], hasAbilityBuildData: false, purchaseEvents: [], hasPurchaseEventsData: false,
    minuteSeries: { gold: [], experience: [], netWorth: Array(11).fill(5_000), lastHits: Array(11).fill(5), heroDamage: [], imp: [] },
    detailEvents: { kills: 0, deaths: 0, assists: 0, wards: 0, runes: 0, itemUses: 0, wardDestructions: 0 },
    combatEvents: { assists: [], deaths: [] },
    dotaPlusLevel: null, totalActions: null,
    ...overrides,
  };
}
