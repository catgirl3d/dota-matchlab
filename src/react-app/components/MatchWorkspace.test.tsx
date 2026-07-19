import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchWorkspace } from './MatchWorkspace';

const mocks = vi.hoisted(() => ({
  accounts: [] as Array<Record<string, unknown>>,
  linkedAccounts: new Map<number, string>(),
  linkedAccountError: null as string | null,
  readLinkedAccount: vi.fn(),
  fetchMatchDetail: vi.fn(),
  fetchHeroNames: vi.fn(),
  importMatch: vi.fn(),
  syncTrackedMatchDetail: vi.fn(),
}));

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ userId: 'user-1' }),
  useSession: () => ({ session: { getToken: vi.fn().mockResolvedValue('clerk-token') } }),
}));

vi.mock('../lib/archive', () => ({
  fetchArchiveOverview: vi.fn(),
  fetchArchivePage: vi.fn(),
}));

vi.mock('../lib/match-detail', () => ({
  fetchMatchDetail: mocks.fetchMatchDetail,
}));

vi.mock('../lib/dota-api', () => ({
  fetchHeroNames: mocks.fetchHeroNames,
  importMatch: mocks.importMatch,
  resolveSteamProfile: vi.fn(),
  syncAllTrackedAccount: vi.fn(),
  syncTrackedAccount: vi.fn(),
  syncTrackedMatchDetail: mocks.syncTrackedMatchDetail,
}));

vi.mock('../lib/supabase', () => ({
  createUserSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'tracked_accounts') {
        return {
          select: () => ({
            order: async () => ({ data: mocks.accounts, error: null }),
          }),
        };
      }
      if (table === 'tracked_account_matches') {
        return {
          select: () => ({
            eq: (_column: string, matchId: number) => ({
              limit: () => ({
                maybeSingle: () => mocks.readLinkedAccount(matchId),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

vi.mock('./MatchDetailView', () => ({
  MatchDetailView: ({ isParsing, onParse }: { isParsing: boolean; onParse: () => void }) => (
    <button type="button" disabled={isParsing} onClick={onParse}>Parse detail</button>
  ),
}));

vi.mock('./PlayerDashboard', () => ({ PlayerDashboard: () => null }));

function renderWorkspace() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MatchWorkspace />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mocks.accounts = [];
  mocks.linkedAccounts.clear();
  mocks.linkedAccountError = null;
  mocks.readLinkedAccount.mockReset().mockImplementation(async (matchId: number) => ({
    data: mocks.linkedAccounts.has(matchId)
      ? { tracked_account_id: mocks.linkedAccounts.get(matchId) }
      : null,
    error: mocks.linkedAccountError ? { message: mocks.linkedAccountError } : null,
  }));
  mocks.fetchMatchDetail.mockReset().mockResolvedValue(null);
  mocks.fetchHeroNames.mockReset().mockResolvedValue({});
  mocks.importMatch.mockReset().mockResolvedValue({
    matchId: 8_749_050_591,
    status: 'available',
    imported: true,
  });
  mocks.syncTrackedMatchDetail.mockReset().mockResolvedValue({
    accountId: 77,
    processedMatches: 1,
    availableMatches: 1,
    failedMatches: 0,
    backfillComplete: true,
  });
  window.history.replaceState(null, '', '/matches/8749050591');
});

describe('MatchWorkspace match routes', () => {
  it('reads a deep link without importing until the explicit action', async () => {
    renderWorkspace();

    const importButton = await screen.findByRole('button', { name: 'Загрузить матч из STRATZ' });
    expect(mocks.fetchMatchDetail).toHaveBeenCalledWith(expect.anything(), 8_749_050_591);
    expect(mocks.importMatch).not.toHaveBeenCalled();

    fireEvent.click(importButton);
    await waitFor(() => expect(mocks.importMatch).toHaveBeenCalledWith('clerk-token', 8_749_050_591));
  });

  it('keeps an archived match on the tracked manual-detail flow', async () => {
    mocks.accounts = [{
      id: 'tracked-1',
      steam_id64: '76561197960265805',
      dota_account_id: 77,
      persona_name: 'Tracked',
      avatar_url: null,
      rank_tier: null,
      profile_refreshed_at: null,
    }];
    mocks.linkedAccounts.set(8_749_050_591, 'tracked-1');
    mocks.fetchMatchDetail.mockResolvedValue({ players: [] });
    renderWorkspace();

    const parseButton = await screen.findByRole('button', { name: 'Parse detail' });
    await waitFor(() => expect(parseButton).toBeEnabled());
    fireEvent.click(parseButton);

    await waitFor(() => expect(mocks.syncTrackedMatchDetail).toHaveBeenCalledWith(
      'clerk-token',
      'tracked-1',
      8_749_050_591,
    ));
    expect(mocks.importMatch).not.toHaveBeenCalled();
  });

  it('does not leak an unavailable result into the next popstate route', async () => {
    mocks.importMatch.mockResolvedValue({
      matchId: 8_749_050_591,
      status: 'unavailable',
      imported: false,
    });
    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: 'Загрузить матч из STRATZ' }));
    expect(await screen.findByText('Матч недоступен у STRATZ.')).toBeVisible();

    window.history.pushState(null, '', '/matches/8749050592');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => {
      expect(screen.getByText('Матч ещё не загружен.')).toBeVisible();
      expect(screen.queryByText('Матч недоступен у STRATZ.')).not.toBeInTheDocument();
    });
  });

  it('retries a failed ownership lookup instead of falling back to public import', async () => {
    mocks.fetchMatchDetail.mockResolvedValue({ players: [] });
    mocks.linkedAccountError = 'lookup failed';
    renderWorkspace();

    const parseButton = await screen.findByRole('button', { name: 'Parse detail' });
    await waitFor(() => expect(parseButton).toBeEnabled());
    expect(mocks.readLinkedAccount).toHaveBeenCalledTimes(1);

    fireEvent.click(parseButton);

    await waitFor(() => expect(mocks.readLinkedAccount).toHaveBeenCalledTimes(2));
    expect(mocks.importMatch).not.toHaveBeenCalled();
    expect(mocks.syncTrackedMatchDetail).not.toHaveBeenCalled();
  });
});
