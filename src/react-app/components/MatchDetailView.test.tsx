import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MatchDetailSnapshot } from '../lib/match-detail';
import { MatchDetailView } from './MatchDetailView';

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
  availableSections: [],
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
    expect(screen.getByText('Базовый разбор')).toBeVisible();
    expect(screen.getAllByText('N/A')).toHaveLength(4);

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
    expect(screen.getByText('+19')).toBeVisible();
    expect(screen.getByText('Top support')).toBeVisible();
    expect(screen.getByText('Shrapnel')).toBeVisible();
    expect(screen.queryByText('Базовый разбор')).not.toBeInTheDocument();

    expect(screen.queryByText('gg')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Показать чат' }));
    expect(screen.getByText('gg')).toBeVisible();
    expect(screen.queryByText('Chat wheel #71')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Всё' }));
    expect(screen.getByText('Chat wheel #71')).toBeVisible();
  });
});

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
    purchaseEvents: [],
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
