import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tables } from '../../shared/database.types';
import type { ArchiveOverview, ArchivePage } from '../lib/archive';
import { DEFAULT_ARCHIVE_FILTERS } from '../lib/archive-analytics';
import { PlayerDashboard } from './PlayerDashboard';

afterEach(() => {
  cleanup();
});

const account: Pick<Tables<'tracked_accounts'>, 'id' | 'avatar_url' | 'persona_name' | 'rank_tier'> & {
  dota_account_id: number;
} = {
  id: '00000000-0000-0000-0000-000000000202',
  avatar_url: null,
  persona_name: 'fish.bone',
  rank_tier: 55,
  dota_account_id: 93_447_624,
};

const snapshot = {
  syncState: {
    status: 'partial',
    history_provider: 'stratz',
    backfill_offset: 100,
    backfill_complete: false,
    last_attempt_at: '2026-07-19T00:00:00.000Z',
    last_success_at: '2026-07-19T00:00:00.000Z',
    next_retry_at: null,
    consecutive_failures: 0,
    last_error_message: null,
    newest_match_id: 2,
    oldest_match_id: 1,
  },
  matches: [
    {
      dataStatus: 'complete' as const,
      matchId: 2,
      startTime: 1_800_000_000,
      durationSeconds: 2_400,
      radiantWin: true,
      gameMode: 22,
      lobbyType: 7,
      averageRank: 55,
      radiantScore: 30,
      direScore: 20,
      playerSlot: 0,
      heroId: 1,
      heroVariant: null,
      kills: 10,
      deaths: 2,
      assists: 8,
      goldPerMinute: 600,
      xpPerMinute: 700,
      lastHits: 300,
      denies: 10,
      heroDamage: 30_000,
      towerDamage: 5_000,
      heroHealing: 0,
      level: 30,
      netWorth: 20_000,
      leaverStatus: 0,
      partySize: 0,
      lane: 1,
      laneRole: 1,
      isRoaming: false,
      won: true,
    },
    {
      dataStatus: 'complete' as const,
      matchId: 1,
      startTime: 1_799_000_000,
      durationSeconds: 1_800,
      radiantWin: false,
      gameMode: 23,
      lobbyType: 7,
      averageRank: 55,
      radiantScore: 20,
      direScore: 30,
      playerSlot: 128,
      heroId: 2,
      heroVariant: null,
      kills: 3,
      deaths: 7,
      assists: 11,
      goldPerMinute: 400,
      xpPerMinute: 550,
      lastHits: 140,
      denies: 2,
      heroDamage: 12_000,
      towerDamage: 1_000,
      heroHealing: 0,
      level: 25,
      netWorth: 12_000,
      leaverStatus: 0,
      partySize: 3,
      lane: 2,
      laneRole: 2,
      isRoaming: false,
      won: false,
    },
  ],
};

const overview: ArchiveOverview = {
  summary: { matches: 2, wins: 1, losses: 1, unknownResults: 0, winRate: 50, averageKills: 6.5, averageDeaths: 4.5, averageAssists: 9.5, averageKda: 2.5, averageGpm: 500, averageXpm: 625, averageLastHits: 220, averageDamage: 21000, averageDurationMinutes: 35, firstMatchAt: 1_799_000_000, latestMatchAt: 1_800_000_000 },
  form: ['win', 'loss'], modes: [], heroes: [{ key: '1', heroId: 1, matches: 1, wins: 1, winRate: 100, averageKda: 9, averageGpm: 600 }], positions: [], lanes: [], party: [], tempo: [], heroOptions: [1, 2], syncState: snapshot.syncState, integrity: { linked: 2, complete: 2, missingStats: 0, missingMatch: 0 },
};

const page: ArchivePage = { matches: snapshot.matches, nextCursor: null };

describe('PlayerDashboard', () => {
  it('renders a public label and no sync controls when mutations are omitted', () => {
    render(
      <MemoryRouter><PlayerDashboard
        account={account}
        overview={overview}
        page={page}
        filters={DEFAULT_ARCHIVE_FILTERS}
        heroNames={{ 1: 'Anti-Mage', 2: 'Axe' }}
        isLoading={false}
        isRefreshing={false}
        error={null}
        onRefresh={vi.fn()}
        onFiltersChange={vi.fn()}
        onNextPage={vi.fn()}
        onPreviousPage={vi.fn()}
        hasPreviousPage={false}
      /></MemoryRouter>,
    );

    expect(screen.getByText('Public read-only showcase')).toBeVisible();
    expect(screen.queryByText('PARTIAL')).not.toBeInTheDocument();
  });

  it('renders archive metrics and filters the match log by result', () => {
    const onFiltersChange = vi.fn();
    const onNextPage = vi.fn();
    const onPreviousPage = vi.fn();
    const nextCursor = { startTime: 1_799_000_000, matchId: 1 };
    render(
      <MemoryRouter><PlayerDashboard
        account={account}
        overview={{ ...overview, summary: { ...overview.summary, winRate: 51 } }}
        page={{ ...page, nextCursor }}
        filters={DEFAULT_ARCHIVE_FILTERS}
        heroNames={{ 1: 'Anti-Mage', 2: 'Axe' }}
        isLoading={false}
        isRefreshing={false}
        error={null}
        onRefresh={vi.fn()}
        onFiltersChange={onFiltersChange}
        onNextPage={onNextPage}
        onPreviousPage={onPreviousPage}
        hasPreviousPage
        syncControls={{ onSyncArchive: vi.fn(), onSyncAllArchive: vi.fn(), archiveSyncError: null, isArchiveSyncing: false, isArchiveSyncingAll: false, archiveSyncProgress: null }}
      /></MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /fish\.bone/ })).toBeVisible();
    expect(screen.getByText('51%')).toBeVisible();
    expect(screen.getByText('51%').closest('.metric-card')).toHaveClass('metric-card--acid');
    expect(screen.getByText('Above even')).toBeVisible();
    expect(screen.getByText('2 complete · 0 missing stats · 0 missing match')).toBeVisible();
    expect(screen.getAllByText('Anti-Mage').length).toBeGreaterThan(0);
    const knownHeroLink = screen.getByRole('link', { name: /Открыть матч 2/i });
    expect(knownHeroLink.querySelector('img[src*="antimage_icon_5fO3"]')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('PARTIAL')).toBeVisible();

    const resultDropdown = screen.getByRole('button', { name: 'Result: All results' });
    const queueDropdown = screen.getByRole('button', { name: 'Queue: Solo / Party' });

    fireEvent.click(resultDropdown);
    expect(screen.getByRole('group', { name: 'Result options' })).toBeVisible();

    fireEvent.click(queueDropdown);
    expect(screen.queryByRole('group', { name: 'Result options' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Queue options' })).toBeVisible();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('group', { name: 'Queue options' })).not.toBeInTheDocument();

    fireEvent.click(resultDropdown);
    fireEvent.click(screen.getByRole('button', { name: 'Wins only' }));
    expect(onFiltersChange).toHaveBeenCalledWith({ ...DEFAULT_ARCHIVE_FILTERS, result: 'wins' });

    fireEvent.click(screen.getByRole('button', { name: 'Hero: All heroes' }));
    const heroSearch = screen.getByRole('searchbox', { name: 'Search hero' });
    fireEvent.change(heroSearch, { target: { value: 'axe' } });
    expect(screen.getByRole('button', { name: 'Axe' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Anti-Mage' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Filter by Anti-Mage' }));
    expect(onFiltersChange).toHaveBeenCalledWith({ ...DEFAULT_ARCHIVE_FILTERS, heroId: 1 });

    expect(knownHeroLink).toHaveAttribute(
      'href',
      '/matches/2?player=93447624',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onNextPage).toHaveBeenCalledWith(nextCursor);
    expect(onPreviousPage).toHaveBeenCalledOnce();
  });

  it('clears the hero filter from Hero Pool', () => {
    const onFiltersChange = vi.fn();
    render(
      <MemoryRouter><PlayerDashboard
        account={account}
        overview={overview}
        page={page}
        filters={{ ...DEFAULT_ARCHIVE_FILTERS, heroId: 1 }}
        heroNames={{ 1: 'Anti-Mage', 2: 'Axe' }}
        isLoading={false}
        isRefreshing={false}
        error={null}
        onRefresh={vi.fn()}
        onFiltersChange={onFiltersChange}
        onNextPage={vi.fn()}
        onPreviousPage={vi.fn()}
        hasPreviousPage={false}
        syncControls={{ onSyncArchive: vi.fn(), onSyncAllArchive: vi.fn(), archiveSyncError: null, isArchiveSyncing: false, isArchiveSyncingAll: false, archiveSyncProgress: null }}
      /></MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтр героя' }));
    expect(onFiltersChange).toHaveBeenCalledWith({ ...DEFAULT_ARCHIVE_FILTERS, heroId: null });
  });

  it('sorts the hero pool by win rate and loss rate when clicking sorting tabs', () => {
    const overviewWithMultipleHeroes: ArchiveOverview = {
      ...overview,
      heroes: [
        { key: '1', heroId: 1, matches: 10, wins: 5, winRate: 50, averageKda: 3, averageGpm: 400 },
        { key: '2', heroId: 2, matches: 5, wins: 4, winRate: 80, averageKda: 4, averageGpm: 500 },
        { key: '3', heroId: 3, matches: 2, wins: 0, winRate: 0, averageKda: 1, averageGpm: 300 },
      ],
    };

    render(
      <MemoryRouter><PlayerDashboard
        account={account}
        overview={overviewWithMultipleHeroes}
        page={page}
        filters={DEFAULT_ARCHIVE_FILTERS}
        heroNames={{ 1: 'Anti-Mage', 2: 'Axe', 3: 'Bane' }}
        isLoading={false}
        isRefreshing={false}
        error={null}
        onRefresh={vi.fn()}
        onFiltersChange={vi.fn()}
        onNextPage={vi.fn()}
        onPreviousPage={vi.fn()}
        hasPreviousPage={false}
      /></MemoryRouter>,
    );

    let rows = screen.getAllByRole('button', { name: /Filter by/ });
    expect(rows[0]).toHaveAttribute('aria-label', 'Filter by Anti-Mage');
    expect(rows[1]).toHaveAttribute('aria-label', 'Filter by Axe');
    expect(rows[2]).toHaveAttribute('aria-label', 'Filter by Bane');

    fireEvent.click(screen.getByRole('button', { name: 'Win rate' }));
    rows = screen.getAllByRole('button', { name: /Filter by/ });
    expect(rows[0]).toHaveAttribute('aria-label', 'Filter by Axe');
    expect(rows[1]).toHaveAttribute('aria-label', 'Filter by Anti-Mage');
    expect(rows[2]).toHaveAttribute('aria-label', 'Filter by Bane');

    fireEvent.click(screen.getByRole('button', { name: 'Loss rate' }));
    rows = screen.getAllByRole('button', { name: /Filter by/ });
    expect(rows[0]).toHaveAttribute('aria-label', 'Filter by Bane');
    expect(rows[1]).toHaveAttribute('aria-label', 'Filter by Anti-Mage');
    expect(rows[2]).toHaveAttribute('aria-label', 'Filter by Axe');
  });

  it('filters the hero pool by minimum games played', () => {
    const overviewWithMultipleHeroes: ArchiveOverview = {
      ...overview,
      heroes: [
        { key: '1', heroId: 1, matches: 10, wins: 5, winRate: 50, averageKda: 3, averageGpm: 400 },
        { key: '2', heroId: 2, matches: 3, wins: 2, winRate: 66.7, averageKda: 4, averageGpm: 500 },
        { key: '3', heroId: 3, matches: 1, wins: 0, winRate: 0, averageKda: 1, averageGpm: 300 },
      ],
    };

    render(
      <MemoryRouter><PlayerDashboard
        account={account}
        overview={overviewWithMultipleHeroes}
        page={page}
        filters={DEFAULT_ARCHIVE_FILTERS}
        heroNames={{ 1: 'Anti-Mage', 2: 'Axe', 3: 'Bane' }}
        isLoading={false}
        isRefreshing={false}
        error={null}
        onRefresh={vi.fn()}
        onFiltersChange={vi.fn()}
        onNextPage={vi.fn()}
        onPreviousPage={vi.fn()}
        hasPreviousPage={false}
      /></MemoryRouter>,
    );

    // Initial state: Min games = 10
    // Bane (1 match) and Axe (3 matches) are hidden. Only Anti-Mage (10 matches) is visible.
    expect(screen.queryByRole('button', { name: 'Filter by Bane' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filter by Axe' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter by Anti-Mage' })).toBeInTheDocument();

    // Toggle Min games to 1
    fireEvent.click(screen.getByRole('button', { name: 'Show heroes with at least 1 games' }));
    expect(screen.getByRole('button', { name: 'Filter by Bane' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter by Axe' })).toBeInTheDocument();

    // Toggle Min games to 2
    fireEvent.click(screen.getByRole('button', { name: 'Show heroes with at least 2 games' }));
    expect(screen.queryByRole('button', { name: 'Filter by Bane' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter by Axe' })).toBeInTheDocument();

    // Toggle Min games to 5
    fireEvent.click(screen.getByRole('button', { name: 'Show heroes with at least 5 games' }));
    expect(screen.queryByRole('button', { name: 'Filter by Axe' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter by Anti-Mage' })).toBeInTheDocument();

    // Toggle Min games to 10
    fireEvent.click(screen.getByRole('button', { name: 'Show heroes with at least 10 games' }));
    expect(screen.getByRole('button', { name: 'Filter by Anti-Mage' })).toBeInTheDocument();
  });

  it('hides synchronization controls in a read-only dashboard', () => {
    render(<MemoryRouter><PlayerDashboard account={account} overview={overview} page={page} filters={DEFAULT_ARCHIVE_FILTERS} heroNames={{}} isLoading={false} isRefreshing={false} error={null} onRefresh={vi.fn()} onFiltersChange={vi.fn()} onNextPage={vi.fn()} onPreviousPage={vi.fn()} hasPreviousPage={false} /></MemoryRouter>);
    expect(screen.queryByText('PARTIAL')).not.toBeInTheDocument();
  });

  it('keeps the textual hero mark when an archive hero has no local icon', () => {
    const unknownHeroPage: ArchivePage = {
      ...page,
      matches: [{ ...snapshot.matches[0], heroId: 999_999 }],
    };

    render(
      <MemoryRouter><PlayerDashboard
        account={account}
        overview={overview}
        page={unknownHeroPage}
        filters={DEFAULT_ARCHIVE_FILTERS}
        heroNames={{}}
        isLoading={false}
        isRefreshing={false}
        error={null}
        onRefresh={vi.fn()}
        onFiltersChange={vi.fn()}
        onNextPage={vi.fn()}
        onPreviousPage={vi.fn()}
        hasPreviousPage={false}
        syncControls={{ onSyncArchive: vi.fn(), onSyncAllArchive: vi.fn(), archiveSyncError: null, isArchiveSyncing: false, isArchiveSyncingAll: false, archiveSyncProgress: null }}
      /></MemoryRouter>,
    );

    const unknownHeroLink = screen.getByRole('link', { name: /Открыть матч 2/i });
    expect(within(unknownHeroLink).getByText('HE')).toBeVisible();
    expect(unknownHeroLink.querySelector('img')).not.toBeInTheDocument();
  });

  it('keeps a linked match visible when player stats are missing', () => {
    const incompletePage: ArchivePage = {
      matches: [{
        ...snapshot.matches[0],
        dataStatus: 'missing_player_stats',
        playerSlot: null,
        heroId: null,
        kills: null,
        deaths: null,
        assists: null,
        goldPerMinute: null,
        xpPerMinute: null,
        won: null,
      }],
      nextCursor: null,
    };

    render(
      <MemoryRouter><PlayerDashboard
        account={account}
        overview={{ ...overview, integrity: { linked: 2, complete: 1, missingStats: 1, missingMatch: 0 } }}
        page={incompletePage}
        filters={DEFAULT_ARCHIVE_FILTERS}
        heroNames={{}}
        isLoading={false}
        isRefreshing={false}
        error={null}
        onRefresh={vi.fn()}
        onFiltersChange={vi.fn()}
        onNextPage={vi.fn()}
        onPreviousPage={vi.fn()}
        hasPreviousPage={false}
        syncControls={{ onSyncArchive: vi.fn(), onSyncAllArchive: vi.fn(), archiveSyncError: null, isArchiveSyncing: false, isArchiveSyncingAll: false, archiveSyncProgress: null }}
      /></MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: /Открыть матч 2/i });
    expect(within(link).getByText('DATA')).toBeVisible();
    expect(within(link).getByText(/Missing player stats/)).toBeVisible();
    expect(within(link).getByText('— / — / —')).toBeVisible();
  });
});
