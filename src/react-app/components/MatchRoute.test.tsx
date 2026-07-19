import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchDetailRoute, MatchRouteLayout, RouteError } from './MatchRoute';

const mocks = vi.hoisted(() => ({
  accounts: [] as Array<Record<string, unknown>>,
  linkedAccounts: new Map<number, string>(),
  linkedAccountError: null as string | null,
  readPerspectiveAccount: vi.fn(),
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
vi.mock('../lib/match-detail', () => ({ fetchMatchDetail: mocks.fetchMatchDetail }));
vi.mock('../lib/dota-api', () => ({
  fetchHeroNames: mocks.fetchHeroNames,
  importMatch: mocks.importMatch,
  syncTrackedMatchDetail: mocks.syncTrackedMatchDetail,
}));
vi.mock('../lib/supabase', () => ({
  createUserSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'tracked_accounts') {
        return {
          select: () => ({
            eq: (_column: string, playerId: number) => ({
              maybeSingle: () => mocks.readPerspectiveAccount(playerId),
            }),
          }),
        };
      }
      if (table === 'tracked_account_matches') {
        return { select: () => ({ eq: (_column: string, matchId: number) => ({ limit: () => ({ maybeSingle: () => mocks.readLinkedAccount(matchId) }) }) }) };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));
vi.mock('./MatchDetailView', () => ({
  MatchDetailView: ({ currentAccountId, isParsing, onParse, onBack }: { currentAccountId: number | null; isParsing: boolean; onParse: () => void; onBack: () => void }) => <div data-player={currentAccountId ?? ''}><button type="button" disabled={isParsing} onClick={onParse}>Parse detail</button><button type="button" onClick={onBack}>Back to archive</button></div>,
}));

function renderRoute(path = '/matches/8749050591') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/" element={<ArchiveRoute />} />
    <Route path="/matches/:matchId" element={<MatchRouteLayout />}><Route index element={<><MatchDetailRoute /><RouteNavigationControl /></>} /></Route>
    <Route path="*" element={<RouteError text="Страница не найдена." />} />
  </Routes></MemoryRouter></QueryClientProvider>);
  return { ...view, queryClient };
}

function RouteNavigationControl() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate('/matches/8749050592')}>Next match</button>;
}

function ArchiveRoute() {
  const location = useLocation();
  const navigationType = useNavigationType();
  return <div>Archive route {location.search} {navigationType}</div>;
}

beforeEach(() => {
  mocks.accounts = [];
  mocks.linkedAccounts.clear();
  mocks.linkedAccountError = null;
  mocks.readPerspectiveAccount.mockReset().mockImplementation(async (playerId: number) => ({
    data: mocks.accounts.find((account) => account.dota_account_id === playerId) ?? null,
    error: null,
  }));
  mocks.readLinkedAccount.mockReset().mockImplementation(async (matchId: number) => ({ data: mocks.linkedAccounts.has(matchId) ? { tracked_account_id: mocks.linkedAccounts.get(matchId) } : null, error: mocks.linkedAccountError ? { message: mocks.linkedAccountError } : null }));
  mocks.fetchMatchDetail.mockReset().mockResolvedValue(null);
  mocks.fetchHeroNames.mockReset().mockResolvedValue({});
  mocks.importMatch.mockReset().mockResolvedValue({ matchId: 8_749_050_591, status: 'available', imported: true });
  mocks.syncTrackedMatchDetail.mockReset().mockResolvedValue({});
});

afterEach(cleanup);

describe('match router', () => {
  it('loads a direct detail route without importing until the explicit action', async () => {
    renderRoute();
    const importButton = await screen.findByRole('button', { name: 'Загрузить матч из STRATZ' });
    expect(mocks.fetchMatchDetail).toHaveBeenCalledWith(expect.anything(), 8_749_050_591);
    expect(mocks.importMatch).not.toHaveBeenCalled();
    expect(mocks.readPerspectiveAccount).not.toHaveBeenCalled();
    fireEvent.click(importButton);
    await waitFor(() => expect(mocks.importMatch).toHaveBeenCalledWith('clerk-token', 8_749_050_591));
  });

  it('keeps a tracked match on the tracked manual-detail flow', async () => {
    mocks.linkedAccounts.set(8_749_050_591, 'tracked-1');
    mocks.fetchMatchDetail.mockResolvedValue({ players: [] });
    renderRoute();
    await waitFor(() => expect(mocks.readLinkedAccount).toHaveBeenCalledOnce());
    fireEvent.click(await screen.findByRole('button', { name: 'Parse detail' }));
    await waitFor(() => expect(mocks.syncTrackedMatchDetail).toHaveBeenCalledWith('clerk-token', 'tracked-1', 8_749_050_591));
    expect(mocks.importMatch).not.toHaveBeenCalled();
  });

  it('does not leak a public import result when navigating to another match', async () => {
    mocks.importMatch.mockResolvedValue({ matchId: 8_749_050_591, status: 'unavailable', imported: false });
    renderRoute();
    fireEvent.click(await screen.findByRole('button', { name: 'Загрузить матч из STRATZ' }));
    expect(await screen.findByText('Матч недоступен у STRATZ.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next match' }));
    await waitFor(() => expect(mocks.fetchMatchDetail).toHaveBeenCalledWith(expect.anything(), 8_749_050_592));
    expect(screen.getByText('Матч ещё не загружен.')).toBeVisible();
    expect(screen.queryByText('Матч недоступен у STRATZ.')).not.toBeInTheDocument();
  });

  it('does not leak public import loading or errors when navigating to another match', async () => {
    mocks.importMatch.mockRejectedValueOnce(new Error('import failed'));
    renderRoute();

    fireEvent.click(await screen.findByRole('button', { name: 'Загрузить матч из STRATZ' }));
    expect(await screen.findByText('import failed')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Next match' }));
    await waitFor(() => expect(mocks.fetchMatchDetail).toHaveBeenCalledWith(expect.anything(), 8_749_050_592));
    expect(screen.queryByText('import failed')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Загрузить матч из STRATZ' })).toBeEnabled();
  });

  it('retries a failed ownership lookup instead of falling back to public import', async () => {
    mocks.fetchMatchDetail.mockResolvedValue({ players: [] });
    mocks.linkedAccountError = 'lookup failed';
    renderRoute();
    await waitFor(() => expect(mocks.readLinkedAccount).toHaveBeenCalledOnce());
    fireEvent.click(await screen.findByRole('button', { name: 'Parse detail' }));
    await waitFor(() => expect(mocks.readLinkedAccount).toHaveBeenCalledTimes(2));
    expect(mocks.importMatch).not.toHaveBeenCalled();
    expect(mocks.syncTrackedMatchDetail).not.toHaveBeenCalled();
  });

  it('renders invalid match IDs and unknown paths as errors', async () => {
    renderRoute('/matches/not-a-match');
    expect(await screen.findByText('Некорректный match ID в URL.')).toBeVisible();
    cleanup();
    renderRoute('/matches/9007199254740992');
    expect(await screen.findByText('Некорректный match ID в URL.')).toBeVisible();
    cleanup();
    renderRoute('/unknown');
    expect(await screen.findByText('Страница не найдена.')).toBeVisible();
  });

  it('uses router navigation to return to the archive', async () => {
    mocks.fetchMatchDetail.mockResolvedValue({ players: [] });
    renderRoute();
    fireEvent.click(await screen.findByRole('button', { name: 'Back to archive' }));
    expect(await screen.findByText(/Archive route/)).toHaveTextContent('REPLACE');
  });

  it('keeps a valid player perspective on back navigation', async () => {
    mocks.accounts = [{ id: 'tracked-1', dota_account_id: 77 }];
    mocks.fetchMatchDetail.mockResolvedValue({ players: [{ accountId: 77 }] });
    const { queryClient } = renderRoute('/matches/8749050591?player=77');
    await waitFor(() => expect(document.querySelector('[data-player="77"]')).toBeInTheDocument());
    expect(queryClient.getQueryData(['tracked-accounts', 'user-1'])).toBeUndefined();
    expect(queryClient.getQueryData(['match-route-player-perspective', 'user-1', 77])).toEqual({
      id: 'tracked-1',
      dota_account_id: 77,
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Back to archive' }));
    expect(await screen.findByText(/Archive route \?player=77/)).toHaveTextContent('REPLACE');
  });

  it('does not query player perspective for absent or malformed player values', async () => {
    renderRoute();
    await screen.findByRole('button', { name: 'Загрузить матч из STRATZ' });
    expect(mocks.readPerspectiveAccount).not.toHaveBeenCalled();

    cleanup();
    renderRoute('/matches/8749050591?player=invalid');
    expect(await screen.findByRole('button', { name: 'Parse detail' })).toBeVisible();
    expect(mocks.readPerspectiveAccount).not.toHaveBeenCalled();
  });

  it('keeps a valid player query when Back is clicked before perspective lookup resolves', async () => {
    let resolvePerspective: (() => void) | undefined;
    mocks.readPerspectiveAccount.mockImplementation(() => new Promise((resolve) => {
      resolvePerspective = () => resolve({ data: { id: 'tracked-1', dota_account_id: 77 }, error: null });
    }));
    renderRoute('/matches/8749050591?player=77');

    await waitFor(() => expect(mocks.readPerspectiveAccount).toHaveBeenCalledWith(77));
    fireEvent.click(await screen.findByRole('button', { name: 'Назад к архиву' }));
    expect(await screen.findByText(/Archive route \?player=77/)).toHaveTextContent('REPLACE');
    resolvePerspective?.();
  });

  it('does not use an untracked player query for match perspective or archive access', async () => {
    mocks.accounts = [{ id: 'tracked-1', dota_account_id: 77 }];
    mocks.fetchMatchDetail.mockResolvedValue({ players: [{ accountId: 77 }] });
    renderRoute('/matches/8749050591?player=78');

    await screen.findByRole('button', { name: 'Back to archive' });
    expect(document.querySelector('[data-player]')).toHaveAttribute('data-player', '');
    fireEvent.click(screen.getByRole('button', { name: 'Back to archive' }));
    expect(await screen.findByText(/Archive route/)).toHaveTextContent('REPLACE');
  });
});
