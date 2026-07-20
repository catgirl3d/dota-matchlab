import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchDetailSnapshot } from '../lib/match-detail';
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
    expect(screen.getAllByText('Anti-Mage').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('img[src*="antimage_icon_5fO3"]')).toHaveLength(2);
    const currentBuild = screen.getByRole('article', { name: 'Build for Player #111' });
    expect(currentBuild.querySelector('img[src*="antimage_horz_gMtz"]')).toBeInTheDocument();
    expect(currentBuild.querySelector('.player-build__portrait img[src*="_icon_"]')).not.toBeInTheDocument();
    const scoreboardPanel = screen.getByRole('heading', { name: 'Ten-player breakdown' }).closest('section');
    expect(scoreboardPanel?.querySelector('img[src*="antimage_icon_5fO3"]')).toBeInTheDocument();
    const scoreboardEntry = screen.getByRole('article', { name: 'Scoreboard entry for Player #111' });
    expect(within(scoreboardEntry).getByRole('group', { name: '22 kills, 2 deaths, 8 assists' })).toBeVisible();
    expect(within(scoreboardEntry).getByText('GPM')).toBeVisible();
    expect(within(scoreboardEntry).getByText('XPM')).toBeVisible();
    expect(within(scoreboardEntry).getByText('NW')).toBeVisible();
    const advantageChart = screen.getByRole('group', { name: 'Team advantage timeline' });
    expect(advantageChart).toHaveClass('advantage-timeline__canvas');
    const draftPanel = screen.getByRole('heading', { name: 'Picks and bans' }).closest('section');
    expect(draftPanel?.querySelector('img[src*="antimage_icon_5fO3"]')).toBeInTheDocument();
    expect(screen.getByText('Базовый разбор')).toBeVisible();
    expect(screen.getByText('2/10 players captured')).toBeVisible();
    expect(screen.getAllByText('N/A')).toHaveLength(4);
    expect(screen.getAllByRole('img', { name: 'Phase Boots' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'Power Treads' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'Keen Optic' })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /Назад к архиву/i }));
    expect(onBack).toHaveBeenCalledOnce();
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

    expect(screen.getByRole('heading', { name: 'Sniper performance tape' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Gold per-minute chart' })).toBeVisible();
    expect(screen.getByText('+19')).toBeVisible();
    expect(screen.getByText('Top support')).toBeVisible();
    const currentBuild = screen.getByRole('article', { name: 'Build for Player #111' });
    expect(within(currentBuild).getByRole('img', { name: 'Shrapnel, 1:48 · level 2' })).toBeVisible();
    expect(currentBuild.querySelector('img[src*="sniper_shrapnel"]')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Boots' })).toBeVisible();
    expect(screen.queryByText('Базовый разбор')).not.toBeInTheDocument();

    expect(screen.queryByText('gg')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Показать чат' }));
    expect(screen.getByText('gg')).toBeVisible();
    expect(screen.queryByText('Chat wheel #71')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Всё' }));
    expect(screen.getByText('Chat wheel #71')).toBeVisible();
    const chatTranscript = screen.getByRole('log', { name: 'Чат матча' });
    expect(chatTranscript.querySelectorAll('img[src*="antimage_icon_5fO3"]')).toHaveLength(2);
    expect(document.querySelectorAll('img[src*="antimage_icon_5fO3"]')).toHaveLength(4);
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
    expect(within(currentBuild).getByRole('img', { name: 'Shrapnel, 2:10 · level 3' })).toBeVisible();
    expect(within(currentBuild).getByText('#99999')).toBeVisible();
    const abilityLevels = currentBuild.querySelectorAll('.build-timeline__ability-level');
    expect(abilityLevels).toHaveLength(12);
    expect(abilityLevels[1]).toHaveTextContent('4');
    expect(currentBuild.querySelector('.build-timeline__token--ability small')).toHaveTextContent('2:10');
    expect(currentBuild.querySelector('.build-timeline__token--ability small')).not.toHaveTextContent(/L\d/);
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
  });

  it('keeps final loadout but labels progression unavailable for basic and partial data', () => {
    render(<MatchDetailView detail={detail} heroNames={{ 1: 'Anti-Mage', 2: 'Axe' }} currentAccountId={111} isLoading={false} error={null} parseError={null} isParsing={false} onBack={vi.fn()} onRefresh={vi.fn()} onParse={vi.fn()} />);

    expect(screen.getAllByText(/progression unavailable\./)).toHaveLength(4);
    expect(screen.getAllByRole('img', { name: 'Phase Boots' }).length).toBeGreaterThan(0);
  });

  it('shows a read-only notice instead of the detail import action', () => {
    const onParse = vi.fn();
    render(<MatchDetailView detail={detail} heroNames={{}} currentAccountId={null} isLoading={false} error={null} parseError={null} isParsing={false} parseDisabledReason="Войдите, чтобы загрузить недостающие данные." backLabel="На главную" onBack={vi.fn()} onRefresh={vi.fn()} onParse={onParse} />);

    expect(screen.getByText('Войдите, чтобы загрузить недостающие данные.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Загрузить полный разбор' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /На главную/ })).toBeVisible();
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

    expect(screen.getByText('Частичный разбор')).toBeVisible();
    expect(screen.queryByText('Базовый разбор')).not.toBeInTheDocument();
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

    expect(screen.getAllByText('UN')).toHaveLength(3);
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

function createSortableDetail(): MatchDetailSnapshot {
  return {
    ...detail,
    players: [
      createPlayer({ key: 'radiant-low', accountId: 1, name: 'Radiant low', playerSlot: 0, isRadiant: true, imp: 4, heroDamage: 900, towerDamage: 700 }),
      createPlayer({ key: 'radiant-high', accountId: 2, name: 'Radiant high', playerSlot: 1, isRadiant: true, imp: 15, heroDamage: 500, towerDamage: 900 }),
      createPlayer({ key: 'dire-low', accountId: 3, name: 'Dire low', playerSlot: 128, isRadiant: false, imp: -2, heroDamage: 700, towerDamage: 400 }),
      createPlayer({ key: 'dire-high', accountId: 4, name: 'Dire high', playerSlot: 129, isRadiant: false, imp: 8, heroDamage: 1_200, towerDamage: 800 }),
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
    award: null,
    itemIds: [50, 63],
    backpackItemIds: [],
    neutralItemId: 287,
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
