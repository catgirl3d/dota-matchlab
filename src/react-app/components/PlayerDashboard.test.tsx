import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tables } from '../../shared/database.types';
import type { ArchiveSnapshot } from '../lib/archive';
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

const snapshot: ArchiveSnapshot = {
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

describe('PlayerDashboard', () => {
  it('renders archive metrics and filters the match log by result', () => {
    const onSelectMatch = vi.fn();
    render(
      <PlayerDashboard
        account={account}
        snapshot={snapshot}
        heroNames={{ 1: 'Anti-Mage', 2: 'Axe' }}
        isLoading={false}
        isRefreshing={false}
        error={null}
        onRefresh={vi.fn()}
        onSelectMatch={onSelectMatch}
        onSyncArchive={vi.fn()}
        onSyncAllArchive={vi.fn()}
        archiveSyncError={null}
        isArchiveSyncing={false}
        isArchiveSyncingAll={false}
        archiveSyncProgress={null}
      />,
    );

    expect(screen.getByRole('heading', { name: /fish\.bone/ })).toBeVisible();
    expect(screen.getByText('50%')).toBeVisible();
    expect(screen.getAllByText('Anti-Mage').length).toBeGreaterThan(0);
    expect(screen.getByText('PARTIAL')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Result'), { target: { value: 'wins' } });

    expect(screen.getByText('1 matches in view')).toBeVisible();
    expect(screen.queryByText('LOSS')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('listitem', { name: /Открыть матч 2/i }));
    expect(onSelectMatch).toHaveBeenCalledWith(2);
  });
});
