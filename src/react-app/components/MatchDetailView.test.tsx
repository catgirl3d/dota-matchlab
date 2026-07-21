import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchDetailSnapshot } from '../lib/match-detail';
import { getItemIcon } from '../lib/item-icons';
import { render } from '../test/setup';
import { MatchDetailView } from './MatchDetailView';

vi.mock('uplot', () => {
  class UPlotMock {
    static pxRatio = 1;
    root: HTMLDivElement;
    over: HTMLDivElement;
    bbox = { left: 0, top: 0, width: 0, height: 0 };
    cursor = { idx: null, left: 0 };
    scales = { x: { min: 0, max: 0 } };

    constructor(_options: unknown, _data: unknown, target: HTMLElement) {
      this.root = document.createElement('div');
      this.over = document.createElement('div');
      this.root.appendChild(this.over);
      target.appendChild(this.root);
    }

    setSize() {}
    destroy() {
      this.root.remove();
    }
  }

  return { default: UPlotMock };
});

afterEach(cleanup);

const detail: MatchDetailSnapshot = {
  matchId: 8_749_050_591,
  startTime: 1_774_788_523,
  durationSeconds: 2_531,
  radiantWin: true,
  gameMode: 23,
  lobbyType: 0,
  averageRank: 55,
  radiantScore: 68,
  direScore: 46,
  source: 'stratz',
  detailStatus: 'not_requested',
  detailFetchedAt: null,
  players: [
    createPlayer({ key: '111', accountId: 111, playerSlot: 0, heroId: 1, kills: 22 }),
    createPlayer({ key: '222', accountId: 222, playerSlot: 128, heroId: 2, kills: 9 }),
  ],
  pickBans: [{ heroId: 1, isPick: true, isRadiant: true, order: 0 }],
  radiantNetworthLeads: [0, 500, 2_000],
  radiantExperienceLeads: [0, -100, 700],
  laneOutcomes: [
    { lane: 'Top lane', outcome: 'RADIANT_VICTORY' },
    { lane: 'Mid lane', outcome: 'DIRE_VICTORY' },
    { lane: 'Bottom lane', outcome: 'TIE' },
  ],
  eventCounts: { chat: 4, towers: 3, runes: null, wards: null, buildings: null, roshan: null },
  chatMessages: [],
  timelineEvents: [],
  availableSections: [],
  rosterStatus: 'incomplete',
};

describe('MatchDetailView', () => {
  it('renders score, scoreboard, draft and returns to archive', () => {
    const onBack = vi.fn();
    render(
      <MatchDetailView
        detail={detail}
        heroNames={{ 1: 'Anti-Mage', 2: 'Axe' }}
        currentAccountId={111}
        isLoading={false}
        error={null}
        parseError={null}
        isParsing={false}
        onBack={onBack}
        onRefresh={vi.fn()}
        onParse={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Ten-player breakdown' })).toBeVisible();
    expect(screen.getByText('68')).toBeVisible();
    expect(screen.getByText('46')).toBeVisible();
    const killStrip = screen.getByRole('region', { name: 'Team kills' });
    expect(killStrip).not.toHaveTextContent('68');
    expect(killStrip).not.toHaveTextContent('46');
    const scoreline = document.querySelector<HTMLElement>('.match-detail__scoreline');
    const radiantOutcome = within(scoreline as HTMLElement).getByText('Radiant').closest<HTMLElement>('.team-outcome');
    const direOutcome = within(scoreline as HTMLElement).getByText('Dire').closest<HTMLElement>('.team-outcome');
    const radiantKills = killStrip.querySelector<HTMLElement>('.match-detail__kill-strip-track-value--radiant');
    fireEvent.pointerEnter(radiantKills as HTMLElement);
    expect(radiantOutcome).toHaveClass('is-focused');
    expect(direOutcome).toHaveClass('is-muted');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.pointerLeave(radiantKills as HTMLElement);
    fireEvent.pointerEnter(radiantOutcome as HTMLElement);
    expect(radiantOutcome).toHaveClass('is-focused');
    expect(direOutcome).toHaveClass('is-muted');
    expect(killStrip).toHaveClass('is-radiant-focused');
    fireEvent.pointerLeave(radiantOutcome as HTMLElement);
    expect(radiantOutcome).not.toHaveClass('is-focused');
    expect(screen.getAllByText('Anti-Mage').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('img[src*="antimage_icon_5fO3"]')).toHaveLength(3);
    const scoreboardPanel = screen.getByRole('heading', { name: 'Ten-player breakdown' }).closest('section');
    const currentBuild = screen.getByRole('article', { name: 'Build for Player #111' });
    expect(currentBuild.querySelector('img[src*="antimage_horz_gMtz"]')).toBeInTheDocument();
    expect(currentBuild.querySelector('.player-build__portrait img[src*="_icon_"]')).not.toBeInTheDocument();
    expect(scoreboardPanel?.querySelector('img[src*="antimage_icon_5fO3"]')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Scoreboard view' })).getByRole('button', { name: 'Split roster view' }));
    const scoreboardEntry = screen.getByRole('article', { name: 'Scoreboard entry for Player #111' });
    expect(within(scoreboardEntry).getByRole('group', { name: '22 kills, 2 deaths, 8 assists' })).toBeVisible();
    expect(within(scoreboardEntry).getByText('GPM')).toBeVisible();
    expect(within(scoreboardEntry).getByText('XPM')).toBeVisible();
    expect(within(scoreboardEntry).getByText('NET')).toBeVisible();
    const advantageChart = screen.getByRole('group', { name: 'Team advantage timeline' });
    expect(advantageChart).toHaveClass('advantage-timeline__canvas');
    const draftPanel = screen.getByRole('heading', { name: 'Picks and bans' }).closest('section');
    expect(draftPanel?.querySelector('img[src*="antimage_icon_5fO3"]')).toBeInTheDocument();
    expect(screen.getByText('Base Parse')).toBeVisible();
    expect(screen.getByText('2/10 players captured')).toBeVisible();
    expect(screen.getAllByRole('img', { name: 'Phase Boots' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'Power Treads' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'Keen Optic' })).toHaveLength(2);
    const lanesPanel = screen.getByRole('heading', { name: 'Lane breakdown' }).closest('section');
    const eventGrid = screen.getByText('MATCH EVENTS / ALL PLAYERS').closest<HTMLElement>('.detail-events');
    expect(lanesPanel).toContainElement(eventGrid);
    expect(eventGrid?.children).toHaveLength(7);
    expect(within(eventGrid as HTMLElement).getAllByText('N/A')).toHaveLength(4);

    fireEvent.click(screen.getByRole('button', { name: /Back to archive/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows the 10-minute economy and role matchup for each lane', () => {
    const laneDetail: MatchDetailSnapshot = {
      ...detail,
      players: [
        createPlayer({ key: 'radiant-offlane', accountId: 1, heroId: 1, position: 3, lane: 3, minuteSeries: laneMinuteSeries(6_200, 62) }),
        createPlayer({ key: 'radiant-soft-support', accountId: 2, heroId: 2, position: 4, lane: 3, minuteSeries: laneMinuteSeries(2_800, 4) }),
        createPlayer({ key: 'dire-carry', accountId: 3, heroId: 1, playerSlot: 128, isRadiant: false, position: 1, lane: 1, minuteSeries: laneMinuteSeries(6_100, 68) }),
        createPlayer({ key: 'dire-hard-support', accountId: 4, heroId: 2, playerSlot: 129, isRadiant: false, position: 5, lane: 1, minuteSeries: laneMinuteSeries(2_400, 2) }),
      ],
    };

    render(<MatchDetailView detail={laneDetail} heroNames={{ 1: 'Anti-Mage', 2: 'Axe' }} currentAccountId={1} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    const lanesPanel = screen.getByRole('heading', { name: 'Lane breakdown' }).closest('section');
    const topLane = within(lanesPanel as HTMLElement).getByRole('article', { name: 'Top lane: Radiant +500' });

    expect(topLane).toHaveTextContent('Calculated at 10:00');
    expect(topLane).toHaveTextContent('Offlane');
    expect(topLane).toHaveTextContent('Soft support');
    expect(topLane).toHaveTextContent('Carry');
    expect(topLane).toHaveTextContent('Hard support');
    expect(topLane).toHaveTextContent('9K');
    expect(topLane).toHaveTextContent('8.5K');
    expect(topLane).toHaveTextContent('66');
    expect(topLane).toHaveTextContent('70');

    fireEvent.pointerEnter(topLane);
    expect(topLane).toHaveClass('is-focused');
    fireEvent.pointerLeave(topLane);
    expect(topLane).not.toHaveClass('is-focused');

    const offlanePortrait = within(topLane).getByRole('button', { name: 'Show Anti-Mage lane stats: Offlane' });
    fireEvent.pointerEnter(offlanePortrait);

    expect(topLane).toHaveTextContent('6.2K');
    expect(topLane).toHaveTextContent('62');
    expect(topLane).toHaveTextContent('8.5K');
    expect(topLane.querySelectorAll('.lane-metric__value.is-player')).toHaveLength(2);
    expect(topLane.querySelectorAll('.lane-role.is-muted')).toHaveLength(3);

    fireEvent.pointerLeave(offlanePortrait);
    expect(topLane).toHaveTextContent('8.5K');
    expect(topLane.querySelectorAll('.lane-metric__value.is-player')).toHaveLength(0);
    expect(topLane.querySelectorAll('.lane-role.is-muted')).toHaveLength(0);
  });

  it('always renders three subdued permanent-upgrade placeholders in the table inventory', () => {
    render(
      <MatchDetailView
        detail={detail}
        heroNames={{ 1: 'Anti-Mage', 2: 'Axe' }}
        currentAccountId={111}
        isLoading={false}
        error={null}
        parseError={null}
        isParsing={false}
        onBack={vi.fn()}
        onRefresh={vi.fn()}
        onParse={vi.fn()}
      />,
    );

    const row = screen.getByRole('row', { name: 'Scoreboard row for Player #111' });
    const upgrades = within(row).getByRole('group', { name: 'Permanent upgrades' });

    expect(upgrades.querySelectorAll('.scoreboard-table__permanent-upgrade')).toHaveLength(3);
    expect(upgrades.querySelectorAll('.scoreboard-table__permanent-upgrade.is-empty')).toHaveLength(3);
    expect(upgrades.querySelectorAll('.scoreboard-table__permanent-placeholder')).toHaveLength(3);
  });

  it('shows permanent Aghanim icons separately from a normal final-inventory Scepter', () => {
    const upgradesDetail: MatchDetailSnapshot = {
      ...detail,
      players: [createPlayer({
        key: '111',
        accountId: 111,
        playerSlot: 0,
        heroId: 1,
        itemIds: [108],
        neutralItemId: null,
        permanentUpgradeItemIds: { scepterItemId: 271, shardItemId: 609, moonShardItemId: 247 },
      })],
    };
    render(
      <MatchDetailView
        detail={upgradesDetail}
        heroNames={{ 1: 'Anti-Mage' }}
        currentAccountId={111}
        isLoading={false}
        error={null}
        parseError={null}
        isParsing={false}
        onBack={vi.fn()}
        onRefresh={vi.fn()}
        onParse={vi.fn()}
      />,
    );

    const row = screen.getByRole('row', { name: 'Scoreboard row for Player #111' });
    const normalInventory = row.querySelector('.scoreboard-table__inventory-items');
    const upgrades = within(row).getByRole('group', { name: 'Permanent upgrades' });
    const upgradeSlots = upgrades.querySelectorAll<HTMLElement>('.scoreboard-table__permanent-upgrade');

    expect(normalInventory?.querySelector('img')).toHaveAttribute('src', getItemIcon(108)?.src);
    expect(upgradeSlots[0]?.querySelector('img')).toHaveAttribute('src', getItemIcon(271)?.src);
    expect(upgradeSlots[1]?.querySelector('img')).toHaveAttribute('src', getItemIcon(609)?.src);
    expect(upgradeSlots[2]?.querySelector('img')).toHaveAttribute('src', getItemIcon(247)?.src);
    expect(upgrades.querySelector('.scoreboard-table__permanent-placeholder')).not.toBeInTheDocument();
    expect(upgrades.querySelector('[title]')).not.toBeInTheDocument();
  });

  it('renders visibly different player timelines for a complete detail payload', () => {
    const completeDetail: MatchDetailSnapshot = {
      ...detail,
      detailStatus: 'available',
      availableSections: ['metadata', 'player_stats', 'players'],
      players: [
        createPlayer({
          key: '111',
          accountId: 111,
          heroId: 1,
          imp: 19,
          award: 'TOP_SUPPORT',
          dotaPlusLevel: 14,
          totalActions: 76_636,
          abilityBuild: [
            { abilityId: 5_154, time: 108, level: 1, name: 'sniper_shrapnel', isTalent: false },
          ],
          purchaseEvents: [{ time: 103, itemId: 29 }],
          hasAbilityBuildData: true,
          hasPurchaseEventsData: true,
          minuteSeries: {
            gold: [0, 400, 700],
            experience: [0, 500, 800],
            netWorth: [600, 2_000, 5_000],
            lastHits: [0, 10, 30],
            heroDamage: [0, 500, 2_000],
            imp: [0, 5, 19],
          },
          detailEvents: {
            kills: 22,
            deaths: 7,
            assists: 30,
            wards: 4,
            runes: 10,
            itemUses: 13,
            wardDestructions: 1,
          },
        }),
      ],
      chatMessages: [
        {
          key: 'text-111-130-0',
          type: 'text',
          time: 130,
          accountId: 111,
          playerName: 'fish.bone',
          heroId: 1,
          isRadiant: true,
          message: 'gg',
          chatWheelId: null,
        },
        {
          key: 'wheel-111-140-0',
          type: 'wheel',
          time: 140,
          accountId: 111,
          playerName: 'fish.bone',
          heroId: 1,
          isRadiant: true,
          message: null,
          chatWheelId: 71,
        },
      ],
    };

    render(
      <MatchDetailView
        detail={completeDetail}
        heroNames={{ 1: 'Sniper' }}
        currentAccountId={111}
        isLoading={false}
        error={null}
        parseError={null}
        isParsing={false}
        onBack={vi.fn()}
        onRefresh={vi.fn()}
        onParse={vi.fn()}
      />,
    );

    const performancePanel = screen.getByRole('heading', { name: 'Sniper performance tape' }).closest('section');
    expect(performancePanel).toBeVisible();
    expect(performancePanel).toHaveClass('full-analysis--radiant');
    expect(within(performancePanel as HTMLElement).getByText('Player #111')).toBeVisible();
    expect(within(performancePanel as HTMLElement).getByText('RADIANT / TELEMETRY')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Gold per-minute chart' })).toBeVisible();
    expect(within(performancePanel as HTMLElement).getByText('+19')).toBeVisible();
    expect(screen.getByText('Top support')).toBeVisible();
    const currentBuild = screen.getByRole('article', { name: 'Build for Player #111' });
    expect(within(currentBuild).getByRole('img', { name: 'Shrapnel, 1:48 · level 2' })).toBeVisible();
    expect(currentBuild.querySelector('img[src*="sniper_shrapnel"]')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Boots' })).toBeVisible();
    expect(screen.queryByText('Base Parse')).not.toBeInTheDocument();

    expect(screen.queryByText('gg')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show chat' }));
    expect(screen.getByText('gg')).toBeVisible();
    expect(screen.queryByText('Chat wheel #71')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Chat wheel #71')).toBeVisible();
    const chatTranscript = screen.getByRole('log', { name: 'Match chat log' });
    expect(chatTranscript.querySelectorAll('img[src*="antimage_icon_5fO3"]')).toHaveLength(2);
    expect(performancePanel?.querySelector('img[src*="antimage_icon_5fO3"]')).toBeInTheDocument();
  });

  it('marks the XP tail as level cap only for a max-level player', () => {
    const levelCapDetail: MatchDetailSnapshot = {
      ...detail,
      detailStatus: 'available',
      availableSections: ['player_stats'],
      players: [createPlayer({
        key: '111',
        accountId: 111,
        heroId: 1,
        level: 30,
        minuteSeries: {
          gold: [0, 400, 700],
          experience: [0, 500, 15_206, 0, 0],
          netWorth: [600, 2_000, 5_000],
          lastHits: [0, 10, 30],
          heroDamage: [0, 500, 2_000],
          imp: [0, 5, 19],
        },
      })],
    };

    const viewProps = {
      heroNames: { 1: 'Sniper' },
      currentAccountId: 111,
      isLoading: false,
      error: null,
      parseError: null,
      isParsing: false,
      onBack: vi.fn(),
      onRefresh: vi.fn(),
      onParse: vi.fn(),
    };
    const { rerender } = render(<MatchDetailView detail={levelCapDetail} {...viewProps} />);

    expect(screen.getByText('LEVEL CAP')).toBeVisible();

    rerender(
      <MatchDetailView
        detail={{
          ...levelCapDetail,
          players: [{ ...levelCapDetail.players[0], level: 29 }],
        }}
        {...viewProps}
      />,
    );

    expect(screen.queryByText('LEVEL CAP')).not.toBeInTheDocument();
  });

  it('groups builds by team, highlights the current account, and renders full timelines', () => {
    const longPurchases = Array.from({ length: 14 }, (_, index) => ({ time: index * 30, itemId: index === 13 ? 99_999 : 29 }));
    const longAbilities = [
      { abilityId: 6_900, time: 10, level: 1, name: null, isTalent: true },
      { abilityId: 1_000, time: 20, level: 2, name: null, isTalent: false },
      { abilityId: 1_001, time: 30, level: 3, name: 'missing_ability', isTalent: false },
      ...Array.from({ length: 9 }, (_, index) => ({ abilityId: 2_000 + index, time: 40 + index * 10, level: 3, name: 'missing_ability', isTalent: false })),
      { abilityId: 5_154, time: 130, level: 2, name: 'sniper_shrapnel', isTalent: false },
    ];
    const buildsDetail: MatchDetailSnapshot = {
      ...detail,
      detailStatus: 'available',
      availableSections: ['players', 'player_stats', 'player_playback'],
      players: [
        createPlayer({ key: '111', accountId: 111, name: 'Current', playerSlot: 4, heroId: 1, abilityBuild: longAbilities, purchaseEvents: longPurchases, hasAbilityBuildData: true, hasPurchaseEventsData: true }),
        createPlayer({ key: '222', accountId: 222, name: 'Opponent', playerSlot: 130, isRadiant: false, heroId: 2, abilityBuild: [], purchaseEvents: [], hasAbilityBuildData: true, hasPurchaseEventsData: true }),
      ],
    };
    render(<MatchDetailView detail={buildsDetail} heroNames={{ 1: 'Anti-Mage', 2: 'Axe' }} currentAccountId={111} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Radiant builds' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Dire builds' })).toBeVisible();
    const radiantColumn = screen.getByRole('heading', { name: 'Radiant builds' }).closest('section');
    const direColumn = screen.getByRole('heading', { name: 'Dire builds' }).closest('section');
    expect(radiantColumn).toContainElement(screen.getByRole('article', { name: 'Build for Current' }));
    expect(direColumn).toContainElement(screen.getByRole('article', { name: 'Build for Opponent' }));
    const currentBuild = screen.getByRole('article', { name: 'Build for Current' });
    expect(currentBuild).toHaveAttribute('aria-current', 'true');
    expect(within(currentBuild).getByText('T')).toBeVisible();
    expect(within(currentBuild).getByText('+12 Desolate Damage')).toBeVisible();
    expect(within(currentBuild).getByRole('img', { name: 'Talent: +12 Desolate Damage, 0:10' })).toBeVisible();
    expect(within(currentBuild).getByText('Ability #1000')).toBeVisible();
    expect(within(currentBuild).getByText('Ability #1001')).toBeVisible();
    const shrapnelAbility = within(currentBuild).getByRole('img', { name: 'Shrapnel, 2:10 · level 3' });
    expect(shrapnelAbility).toBeVisible();
    expect(within(currentBuild).getByText('#99999')).toBeVisible();
    const abilityLevels = currentBuild.querySelectorAll('.build-timeline__ability-level');
    expect(abilityLevels).toHaveLength(12);
    expect(abilityLevels[1]).toHaveTextContent('4');
    expect(shrapnelAbility.querySelector('small')).toHaveTextContent('2:10');
    expect(shrapnelAbility.querySelector('small')).not.toHaveTextContent(/L\d/);
    expect(within(currentBuild).queryByRole('button', { name: /more events/i })).not.toBeInTheDocument();
  });

  it('sorts both team build columns by the selected descending metric', () => {
    const sortableDetail = createSortableDetail();

    render(<MatchDetailView detail={sortableDetail} heroNames={{}} currentAccountId={null} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    const radiantColumn = screen.getByRole('heading', { name: 'Radiant builds' }).closest('section');
    const direColumn = screen.getByRole('heading', { name: 'Dire builds' }).closest('section');
    expect(buildOrder(radiantColumn)).toEqual(['Build for Radiant low', 'Build for Radiant high']);
    expect(buildOrder(direColumn)).toEqual(['Build for Dire low', 'Build for Dire high']);

    const buildSortControls = within(screen.getByRole('group', { name: 'Sort team builds' }));
    fireEvent.click(buildSortControls.getByRole('button', { name: 'IMP' }));
    expect(buildOrder(radiantColumn)).toEqual(['Build for Radiant high', 'Build for Radiant low']);
    expect(buildOrder(direColumn)).toEqual(['Build for Dire high', 'Build for Dire low']);

    fireEvent.click(buildSortControls.getByRole('button', { name: 'Hero damage' }));
    expect(buildOrder(radiantColumn)).toEqual(['Build for Radiant low', 'Build for Radiant high']);
    expect(buildOrder(direColumn)).toEqual(['Build for Dire high', 'Build for Dire low']);

    fireEvent.click(buildSortControls.getByRole('button', { name: 'Tower damage' }));
    expect(buildOrder(radiantColumn)).toEqual(['Build for Radiant high', 'Build for Radiant low']);
    expect(buildOrder(direColumn)).toEqual(['Build for Dire high', 'Build for Dire low']);
  });

  it('sorts scoreboard columns and calculates player achievement badges', () => {
    render(<MatchDetailView detail={createSortableDetail()} heroNames={{}} currentAccountId={null} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    fireEvent.click(within(screen.getByRole('group', { name: 'Scoreboard view' })).getByRole('button', { name: 'Split roster view' }));
    const scoreboardPanel = screen.getByRole('heading', { name: 'Ten-player breakdown' }).closest('section');
    const [radiantRoster, direRoster] = Array.from(scoreboardPanel?.querySelectorAll<HTMLElement>('.team-roster') ?? []);
    expect(scoreboardOrder(radiantRoster)).toEqual(['Scoreboard entry for Radiant low', 'Scoreboard entry for Radiant high']);
    expect(scoreboardOrder(direRoster)).toEqual(['Scoreboard entry for Dire low', 'Scoreboard entry for Dire high']);
    expect(screen.getByRole('article', { name: 'Scoreboard entry for Radiant high' })).toHaveClass('is-highest');
    expect(screen.getByRole('article', { name: 'Scoreboard entry for Dire high' })).toHaveClass('is-second');
    const radiantHigh = screen.getByRole('article', { name: 'Scoreboard entry for Radiant high' });
    const direHigh = screen.getByRole('article', { name: 'Scoreboard entry for Dire high' });
    expect(within(radiantHigh).getByText('MVP')).toBeVisible();
    expect(within(radiantHigh).getByText('MOST TD')).toBeVisible();
    expect(within(direHigh).getByText('TOP 2 IMP')).toBeVisible();
    expect(within(direHigh).getByText('MOST DMG')).toBeVisible();

    const scoreboardSortControls = within(screen.getByRole('group', { name: 'Sort ten-player breakdown' }));
    fireEvent.click(scoreboardSortControls.getByRole('button', { name: 'Hero damage' }));
    expect(scoreboardOrder(radiantRoster)).toEqual(['Scoreboard entry for Radiant low', 'Scoreboard entry for Radiant high']);
    expect(scoreboardOrder(direRoster)).toEqual(['Scoreboard entry for Dire high', 'Scoreboard entry for Dire low']);

    fireEvent.click(scoreboardSortControls.getByRole('button', { name: 'NET' }));
    expect(scoreboardOrder(radiantRoster)).toEqual(['Scoreboard entry for Radiant high', 'Scoreboard entry for Radiant low']);
    expect(scoreboardOrder(direRoster)).toEqual(['Scoreboard entry for Dire high', 'Scoreboard entry for Dire low']);
  });

  it('shows the complete stat table by default without changing team-aware sorting', () => {
    render(<MatchDetailView detail={createSortableDetail()} heroNames={{}} currentAccountId={null} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    const viewControls = within(screen.getByRole('group', { name: 'Scoreboard view' }));
    const table = screen.getByRole('table', { name: 'Ten-player scoreboard table' });
    expect(viewControls.getByRole('button', { name: 'Table view' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(table).getByText('LH / DN')).toBeVisible();
    expect(within(table).getByText('Inventory')).toBeVisible();
    expect(table.querySelector('.scoreboard-table__team-break')).toHaveTextContent('Dire');
    expect(table.querySelector('.scoreboard-table__totals-heading')).toHaveTextContent('Team totals');
    const economyHeader = within(table).getByRole('columnheader', { name: 'GPM / XPM' });
    fireEvent.pointerEnter(economyHeader.querySelector('.app-tooltip__trigger') as HTMLElement);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Gold per minute / Experience per minute');
    expect(tableRows(table)).toEqual([
      'Scoreboard row for Radiant low',
      'Scoreboard row for Radiant high',
      'Scoreboard row for Dire low',
      'Scoreboard row for Dire high',
    ]);
    const totalsPreview = within(table).getByRole('region', { name: 'Team totals' });
    expect(totalsPreview).toHaveTextContent('Team performance');
    expect(within(totalsPreview).getByRole('article', { name: 'KDA Kills comparison' })).toBeVisible();
    expect(within(totalsPreview).getByRole('article', { name: 'KDA Deaths comparison' })).toBeVisible();
    expect(within(totalsPreview).getByRole('article', { name: 'KDA Assists comparison' })).toBeVisible();
    expect(within(totalsPreview).getByRole('article', { name: 'Economy Net worth comparison' })).toBeVisible();
    expect(within(totalsPreview).getByRole('article', { name: 'Farm Last hits comparison' })).toBeVisible();
    expect(within(totalsPreview).getByRole('article', { name: 'Damage Hero damage comparison' })).toBeVisible();
    const killsTotalCard = within(totalsPreview).getByRole('article', { name: 'KDA Kills comparison' });
    const assistsTotalCard = within(totalsPreview).getByRole('article', { name: 'KDA Assists comparison' });
    const netWorthTotalCard = within(totalsPreview).getByRole('article', { name: 'Economy Net worth comparison' });
    const heroDamageTotalCard = within(totalsPreview).getByRole('article', { name: 'Damage Hero damage comparison' });
    expect(netWorthTotalCard).toHaveClass('team-comparison-card--radiant');
    expect(netWorthTotalCard).toHaveTextContent('(54%)');
    expect(heroDamageTotalCard).toHaveClass('team-comparison-card--dire');
    expect(heroDamageTotalCard).toHaveTextContent('(58%)');
    const radiantHighRow = table.querySelector('[aria-label="Scoreboard row for Radiant high"]') as HTMLElement;
    fireEvent.click(radiantHighRow);
    expect(radiantHighRow).toHaveClass('is-contribution-selected');
    expect(netWorthTotalCard).toHaveClass('has-contribution--radiant');
    expect(netWorthTotalCard).toHaveTextContent('Radiant high');
    expect(netWorthTotalCard).toHaveTextContent('24K');
    fireEvent.click(radiantHighRow);
    expect(radiantHighRow).not.toHaveClass('is-contribution-selected');
    expect(netWorthTotalCard).not.toHaveClass('has-contribution--radiant');
    fireEvent.pointerEnter(killsTotalCard);
    expect(killsTotalCard).toHaveClass('is-focused');
    expect(assistsTotalCard).toHaveClass('is-muted');
    fireEvent.pointerLeave(killsTotalCard);
    expect(killsTotalCard).not.toHaveClass('is-focused');
    const radiantTotal = table.querySelector('[aria-label="Radiant total"]') as HTMLElement;
    const direTotal = table.querySelector('[aria-label="Dire total"]') as HTMLElement;
    expect(radiantTotal).toHaveTextContent('0 / 4 / 16');
    expect(radiantTotal).toHaveTextContent('42K');
    expect(radiantTotal).toHaveTextContent('+9.5');
    expect(radiantTotal).toHaveTextContent('1.4K / 1.6K');
    expect(radiantTotal.querySelectorAll('td')).toHaveLength(9);
    expect(radiantTotal.lastElementChild).toBeEmptyDOMElement();
    expect(direTotal).toHaveTextContent('+3');
    const direHighRow = table.querySelector('[aria-label="Scoreboard row for Dire high"]') as HTMLElement;
    expect(within(radiantHighRow).getByText('MVP')).toBeVisible();
    expect(within(radiantHighRow).getByRole('img', { name: 'Phase Boots' })).toBeVisible();
    expect(radiantHighRow.querySelectorAll('td')[3]?.querySelector('.scoreboard-table__record')).toHaveTextContent('+15');
    expect(radiantHighRow.querySelectorAll('td')[7]?.querySelector('.scoreboard-table__record')).toHaveTextContent('900');
    expect(direHighRow.querySelectorAll('td')[6]?.querySelector('.scoreboard-table__record')).toHaveTextContent('1.2K');

    fireEvent.click(within(screen.getByRole('group', { name: 'Sort ten-player breakdown' })).getByRole('button', { name: 'Hero damage' }));
    expect(tableRows(table)).toEqual([
      'Scoreboard row for Radiant low',
      'Scoreboard row for Radiant high',
      'Scoreboard row for Dire high',
      'Scoreboard row for Dire low',
    ]);

    fireEvent.click(viewControls.getByRole('button', { name: 'Split roster view' }));
    expect(screen.getByRole('article', { name: 'Scoreboard entry for Radiant high' })).toBeVisible();
    const netWorthLabel = within(screen.getByRole('article', { name: 'Scoreboard entry for Radiant high' })).getByText('NET');
    fireEvent.pointerEnter(netWorthLabel.parentElement as HTMLElement);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Net worth');
  });

  it('shows metric context when hovering table values', () => {
    render(<MatchDetailView detail={detail} heroNames={{ 1: 'Anti-Mage', 2: 'Axe' }} currentAccountId={111} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    const bestRow = screen.getByRole('row', { name: 'Scoreboard row for Player #111' });
    const bestKillsTrigger = within(bestRow).getByText('22').closest<HTMLElement>('.app-tooltip__trigger');
    fireEvent.pointerEnter(bestKillsTrigger as HTMLElement);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Kills · Best in match');
    expect(bestKillsTrigger).not.toHaveAttribute('title');

    fireEvent.pointerLeave(bestKillsTrigger as HTMLElement);
    const otherRow = screen.getByRole('row', { name: 'Scoreboard row for Player #222' });
    const otherKillsTrigger = within(otherRow).getByText('9').closest<HTMLElement>('.app-tooltip__trigger');
    fireEvent.pointerEnter(otherKillsTrigger as HTMLElement);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Kills');
  });

  it('marks the numeric team IMP total unavailable when any player IMP is missing', () => {
    const detailWithMissingImp = createSortableDetail();
    detailWithMissingImp.players[0] = { ...detailWithMissingImp.players[0], imp: null };

    render(<MatchDetailView detail={detailWithMissingImp} heroNames={{}} currentAccountId={null} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    const table = screen.getByRole('table', { name: 'Ten-player scoreboard table' });
    expect(table.querySelector('[aria-label="Radiant total"]')).toHaveTextContent('N/A');
    expect(within(table).getByRole('region', { name: 'Team totals' })).toHaveTextContent('KDA / Kills');
  });

  it('renders each player position beside the hero portrait with the role on hover', () => {
    render(<MatchDetailView detail={createSortableDetail()} heroNames={{}} currentAccountId={null} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    fireEvent.click(within(screen.getByRole('group', { name: 'Scoreboard view' })).getByRole('button', { name: 'Split roster view' }));
    const radiantHigh = screen.getByRole('article', { name: 'Scoreboard entry for Radiant high' });
    const radiantPosition = within(radiantHigh).getByRole('img', { name: 'Mid' });
    expect(radiantPosition).toHaveClass('scoreboard-player__position');
    expect(radiantPosition).not.toHaveAttribute('title');
    const radiantHeroGroup = radiantPosition.closest('.scoreboard-player__hero-with-position');
    expect(radiantHeroGroup?.firstElementChild).toHaveClass('scoreboard-player__hero');
    expect(radiantHeroGroup?.lastElementChild).toContainElement(radiantPosition);
    fireEvent.pointerEnter(radiantPosition.parentElement as HTMLElement);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Mid');

    fireEvent.click(within(screen.getByRole('group', { name: 'Scoreboard view' })).getByRole('button', { name: 'Table view' }));

    const direHigh = screen.getByRole('row', { name: 'Scoreboard row for Dire high' });
    const direPosition = within(direHigh).getByRole('img', { name: 'Light support' });
    expect(direPosition).toHaveClass('scoreboard-player__position');
    const direHeroGroup = direPosition.closest('.scoreboard-player__hero-with-position');
    expect(direHeroGroup?.firstElementChild).toHaveClass('scoreboard-player__hero');
    expect(direHeroGroup?.lastElementChild).toContainElement(direPosition);
    fireEvent.pointerEnter(direPosition.parentElement as HTMLElement);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Light support');
    expect(within(direHigh).queryByText('Hero #4 · Light support')).not.toBeInTheDocument();
  });

  it('shares achievement badges for tied highs and excludes zero tower damage', () => {
    const tiedAchievementDetail: MatchDetailSnapshot = {
      ...detail,
      players: [
        createPlayer({ key: 'radiant', accountId: 1, name: 'Radiant', playerSlot: 0, isRadiant: true, imp: 10, heroDamage: 1_000, towerDamage: 0 }),
        createPlayer({ key: 'dire', accountId: 2, name: 'Dire', playerSlot: 128, isRadiant: false, imp: 5, heroDamage: 1_000, towerDamage: 0 }),
      ],
    };

    render(<MatchDetailView detail={tiedAchievementDetail} heroNames={{}} currentAccountId={null} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    expect(screen.getAllByText('MOST DMG')).toHaveLength(2);
    expect(screen.queryByText('MOST TD')).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('group', { name: 'Scoreboard view' })).getByRole('button', { name: 'Table view' }));
    const table = screen.getByRole('table', { name: 'Ten-player scoreboard table' });
    for (const row of table.querySelectorAll<HTMLTableRowElement>('tbody tr[aria-label]')) {
      expect(row.querySelectorAll('td')[6]?.querySelector('.scoreboard-table__record')).toHaveTextContent('1K');
    }
  });

  it('keeps final loadout but labels progression unavailable for basic and partial data', () => {
    render(<MatchDetailView detail={detail} heroNames={{ 1: 'Anti-Mage', 2: 'Axe' }} currentAccountId={111} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    expect(screen.getAllByText(/progression unavailable\./)).toHaveLength(4);
    expect(screen.getAllByRole('img', { name: 'Phase Boots' }).length).toBeGreaterThan(0);
  });

  it('shows a read-only notice instead of the detail import action', () => {
    const onParse = vi.fn();
    render(<MatchDetailView detail={detail} heroNames={{}} currentAccountId={null} isLoading={false} error={null} parseError={null} isParsing={false} parseDisabledReason="Sign in to load missing data." backLabel="Back to home" onBack={vi.fn()} onRefresh={vi.fn()} onParse={onParse} />);

    expect(screen.getByText('Sign in to load missing data.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Load Full Parse' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to home/ })).toBeVisible();
    expect(onParse).not.toHaveBeenCalled();
  });

  it('keeps player progression visible after an overall detail failure and distinguishes empty data from unavailable data', () => {
    const partialDetail: MatchDetailSnapshot = {
      ...detail,
      detailStatus: 'failed',
      availableSections: ['players', 'player_stats'],
      players: [
        createPlayer({
          key: '111', accountId: 111, name: 'Radiant', playerSlot: 0, heroId: 1,
          abilityBuild: [], purchaseEvents: [], hasAbilityBuildData: true, hasPurchaseEventsData: true,
        }),
        createPlayer({
          key: '222', accountId: 222, name: 'Dire', playerSlot: 128, isRadiant: false, heroId: 2,
          hasAbilityBuildData: false, hasPurchaseEventsData: false,
        }),
      ],
    };
    render(<MatchDetailView detail={partialDetail} heroNames={{ 1: 'Anti-Mage', 2: 'Axe' }} currentAccountId={111} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    expect(screen.getByText('Partial Parse')).toBeVisible();
    expect(screen.queryByText('Base Parse')).not.toBeInTheDocument();
    expect(screen.getByText('No ability events')).toBeVisible();
    expect(screen.getByText('No purchase events')).toBeVisible();
    expect(screen.getByText('Ability progression unavailable.')).toBeVisible();
    expect(screen.getByText('Purchase progression unavailable.')).toBeVisible();
  });


  it('does not show a roster warning for a complete ten-player roster', () => {
    const completeRosterDetail: MatchDetailSnapshot = {
      ...detail,
      detailStatus: 'available',
      rosterStatus: 'complete',
      players: Array.from({ length: 10 }, (_, index) => createPlayer({
        key: String(index),
        accountId: index + 1,
        playerSlot: index < 5 ? index : 123 + index,
        isRadiant: index < 5,
        heroId: index + 1,
      })),
    };

    render(<MatchDetailView detail={completeRosterDetail} heroNames={{}} currentAccountId={1} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    expect(screen.queryByText('10/10 players captured')).not.toBeInTheDocument();
  });

  it('keeps the textual hero mark when no local hero icon exists', () => {
    const unknownHeroDetail: MatchDetailSnapshot = {
      ...detail,
      players: [createPlayer({ key: 'unknown', accountId: 111, heroId: 999_999 })],
      pickBans: [{ heroId: 999_999, isPick: false, isRadiant: false, order: 0 }],
    };

    render(<MatchDetailView detail={unknownHeroDetail} heroNames={{ 999_999: 'Unknown hero' }} currentAccountId={111} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    expect(screen.getAllByText('UN')).toHaveLength(4);
    expect(document.querySelector('img[src*="999999"]')).not.toBeInTheDocument();
    expect(document.querySelector('.player-build__portrait img')).not.toBeInTheDocument();
    const draftPanel = screen.getByRole('heading', { name: 'Picks and bans' }).closest('section');
    expect(draftPanel).toHaveTextContent('UN');
    expect(draftPanel?.querySelector('img')).not.toBeInTheDocument();
  });
});

function buildOrder(column: HTMLElement | null): string[] {
  return Array.from(column?.querySelectorAll<HTMLElement>('.player-build') ?? [])
    .map((player) => player.getAttribute('aria-label') ?? '');
}

function scoreboardOrder(roster: HTMLElement | undefined): string[] {
  return Array.from(roster?.querySelectorAll<HTMLElement>('.scoreboard-player') ?? [])
    .map((player) => player.getAttribute('aria-label') ?? '');
}

function tableRows(table: HTMLElement): string[] {
  return Array.from(table.querySelectorAll<HTMLTableRowElement>('tbody tr[aria-label]'))
    .map((row) => row.getAttribute('aria-label') ?? '');
}

function createSortableDetail(): MatchDetailSnapshot {
  return {
    ...detail,
    players: [
      createPlayer({ key: 'radiant-low', accountId: 1, name: 'Radiant low', playerSlot: 0, isRadiant: true, imp: 4, netWorth: 18_000, heroDamage: 900, towerDamage: 700, position: 1 }),
      createPlayer({ key: 'radiant-high', accountId: 2, name: 'Radiant high', playerSlot: 1, isRadiant: true, imp: 15, netWorth: 24_000, heroDamage: 500, towerDamage: 900, position: 2, role: 'MID' }),
      createPlayer({ key: 'dire-low', accountId: 3, name: 'Dire low', playerSlot: 128, isRadiant: false, imp: -2, netWorth: 14_000, heroDamage: 700, towerDamage: 400, position: 4 }),
      createPlayer({ key: 'dire-high', accountId: 4, name: 'Dire high', playerSlot: 129, isRadiant: false, imp: 8, netWorth: 22_000, heroDamage: 1_200, towerDamage: 800, position: 5, role: 'LIGHT_SUPPORT' }),
    ],
  };
}

function createPlayer(
  overrides: Partial<MatchDetailSnapshot['players'][number]>,
): MatchDetailSnapshot['players'][number] {
  return {
    key: 'slot',
    accountId: null,
    playerSlot: 0,
    isRadiant: true,
    name: null,
    heroId: null,
    kills: 0,
    deaths: 2,
    assists: 8,
    goldPerMinute: 700,
    xpPerMinute: 800,
    lastHits: 200,
    denies: 5,
    heroDamage: 30_000,
    towerDamage: 5_000,
    heroHealing: 0,
    netWorth: 20_000,
    level: 30,
    imp: 5,
    role: 'CORE',
    position: 1,
    lane: null,
    award: null,
    itemIds: [50, 63],
    backpackItemIds: [],
    neutralItemId: 287,
    permanentUpgradeItemIds: { scepterItemId: null, shardItemId: null, moonShardItemId: null },
    abilityBuild: [],
    hasAbilityBuildData: false,
    purchaseEvents: [],
    hasPurchaseEventsData: false,
    minuteSeries: {
      gold: [],
      experience: [],
      netWorth: [],
      lastHits: [],
      heroDamage: [],
      imp: [],
    },
    detailEvents: {
      kills: 0,
      deaths: 0,
      assists: 0,
      wards: 0,
      runes: 0,
      itemUses: 0,
      wardDestructions: 0,
    },
    dotaPlusLevel: null,
    totalActions: null,
    ...overrides,
  };
}

function laneMinuteSeries(netWorth: number, lastHits: number) {
  return {
    gold: [],
    experience: [],
    netWorth: Array.from({ length: 11 }, () => netWorth),
    lastHits: Array.from({ length: 11 }, (_, minute) => minute < 10 ? Math.floor(lastHits / 10) : lastHits % 10),
    heroDamage: [],
    imp: [],
  };
}
