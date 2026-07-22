import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchArchiveOverview, fetchArchivePage } from '../lib/archive';
import { render } from '../test/setup';
import { MatchWorkspace } from './MatchWorkspace';

const mocks = vi.hoisted(() => ({
  accounts: [] as Array<Record<string, unknown>>,
  accountsQuery: vi.fn(),
}));
// ... rest of the mocks
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ userId: 'user-1' }),
  useSession: () => ({ session: { getToken: vi.fn().mockResolvedValue('clerk-token') } }),
}));
vi.mock('../lib/archive', () => ({
  fetchArchiveOverview: vi.fn().mockResolvedValue({}),
  fetchArchivePage: vi.fn().mockResolvedValue({}),
}));
vi.mock('../lib/dota-api', () => ({
  resolveSteamProfile: vi.fn(),
  syncAllTrackedAccount: vi.fn(),
  syncTrackedAccount: vi.fn(),
}));
vi.mock('../lib/supabase', () => ({
  createUserSupabaseClient: () => ({
    from: (table: string) => {
      if (table !== 'tracked_accounts') throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          order: () => mocks.accountsQuery(),
        }),
      };
    },
  }),
}));
vi.mock('./PlayerDashboard', () => ({
  PlayerDashboard: ({
    account,
    overview,
    page,
    onFiltersChange,
  }: {
    account: { dota_account_id: number };
    overview: unknown;
    page: unknown;
    onFiltersChange: (filters: Record<string, unknown>) => void;
  }) => (
    <div>
      <div>Active account {account.dota_account_id}</div>
      <output data-testid="overview-state">{overview ? 'ready' : 'empty'}</output>
      <output data-testid="page-state">{page ? 'ready' : 'empty'}</output>
      <button
        type="button"
        onClick={() => onFiltersChange({
          period: 'all', mode: 'all', position: 'all', result: 'all', party: 'all', heroId: 1,
        })}
      >
        Filter by hero
      </button>
    </div>
  ),
}));
vi.mock('./ArchiveShowcase', () => ({
  ArchiveShowcase: ({ dotaAccountId }: { dotaAccountId: number }) => <div>Public showcase {dotaAccountId}</div>,
}));

function LocationProbe() {
  const location = useLocation();
  const navigationType = useNavigationType();
  return <output data-testid="location">{location.search} {navigationType}</output>;
}

function renderWorkspace(
  path: string,
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <LocationProbe />
          <MatchWorkspace />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.accounts = [{
    id: 'tracked-1',
    steam_id64: '76561197960265805',
    dota_account_id: 77,
    persona_name: 'Tracked',
    avatar_url: null,
    rank_tier: null,
    profile_refreshed_at: null,
  }];
  mocks.accountsQuery.mockReset().mockResolvedValue({ data: mocks.accounts, error: null });
  vi.mocked(fetchArchiveOverview).mockReset().mockResolvedValue({} as never);
  vi.mocked(fetchArchivePage).mockReset().mockResolvedValue({} as never);
});

afterEach(cleanup);

describe('MatchWorkspace player query', () => {
  it('replaces an invalid player parameter and preserves unrelated search parameters', async () => {
    renderWorkspace('/?player=invalid&view=matches');

    expect(await screen.findByText('Active account 77')).toBeVisible();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?view=matches REPLACE'));
  });

  it('keeps an explicit unowned player parameter for the public showcase', async () => {
    renderWorkspace('/?player=78');

    expect(await screen.findByText('Public showcase 78')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('?player=78 POP');
    expect(fetchArchiveOverview).not.toHaveBeenCalled();
  });

  it('keeps an absent player parameter as the default account route', async () => {
    renderWorkspace('/?view=matches');

    expect(await screen.findByText('Active account 77')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('?view=matches POP');
  });

  it('reuses fresh account and archive data after remounting', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const firstRender = renderWorkspace('/?player=77', queryClient);

    expect(await screen.findByText('Active account 77')).toBeVisible();
    firstRender.unmount();
    renderWorkspace('/?player=77', queryClient);

    expect(await screen.findByText('Active account 77')).toBeVisible();
    expect(mocks.accountsQuery).toHaveBeenCalledTimes(1);
    expect(fetchArchiveOverview).toHaveBeenCalledTimes(1);
    expect(fetchArchivePage).toHaveBeenCalledTimes(1);
  });

  it('keeps archive snapshots while a hero-filter query is pending', async () => {
    const overviewDeferred = deferred<unknown>();
    const pageDeferred = deferred<unknown>();
    vi.mocked(fetchArchiveOverview)
      .mockResolvedValueOnce({} as never)
      .mockImplementationOnce(() => overviewDeferred.promise as never);
    vi.mocked(fetchArchivePage)
      .mockResolvedValueOnce({} as never)
      .mockImplementationOnce(() => pageDeferred.promise as never);

    renderWorkspace('/?player=77');

    await waitFor(() => expect(screen.getByTestId('overview-state')).toHaveTextContent('ready'));
    await waitFor(() => expect(screen.getByTestId('page-state')).toHaveTextContent('ready'));

    fireEvent.click(screen.getByRole('button', { name: 'Filter by hero' }));

    await waitFor(() => expect(fetchArchiveOverview).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(fetchArchivePage).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('overview-state')).toHaveTextContent('ready');
    expect(screen.getByTestId('page-state')).toHaveTextContent('ready');

    overviewDeferred.resolve({});
    pageDeferred.resolve({});
  });
});
