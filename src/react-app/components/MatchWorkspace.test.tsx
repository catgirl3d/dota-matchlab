import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchWorkspace } from './MatchWorkspace';

const mocks = vi.hoisted(() => ({
  accounts: [] as Array<Record<string, unknown>>,
}));

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ userId: 'user-1' }),
  useSession: () => ({ session: { getToken: vi.fn().mockResolvedValue('clerk-token') } }),
}));
vi.mock('../lib/archive', () => ({
  fetchArchiveOverview: vi.fn().mockResolvedValue({}),
  fetchArchivePage: vi.fn().mockResolvedValue({}),
}));
vi.mock('../lib/dota-api', () => ({
  fetchHeroNames: vi.fn().mockResolvedValue({}),
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
          order: async () => ({ data: mocks.accounts, error: null }),
        }),
      };
    },
  }),
}));
vi.mock('./PlayerDashboard', () => ({
  PlayerDashboard: ({ account }: { account: { dota_account_id: number } }) => (
    <div>Active account {account.dota_account_id}</div>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  const navigationType = useNavigationType();
  return <output data-testid="location">{location.search} {navigationType}</output>;
}

function renderWorkspace(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <MatchWorkspace />
      </MemoryRouter>
    </QueryClientProvider>,
  );
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
});

afterEach(cleanup);

describe('MatchWorkspace player query', () => {
  it('replaces an invalid player parameter and preserves unrelated search parameters', async () => {
    renderWorkspace('/?player=invalid&view=matches');

    expect(await screen.findByText('Active account 77')).toBeVisible();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?view=matches REPLACE'));
  });

  it('replaces an unowned player parameter', async () => {
    renderWorkspace('/?player=78');

    expect(await screen.findByText('Active account 77')).toBeVisible();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('REPLACE'));
    expect(screen.getByTestId('location')).not.toHaveTextContent('player=');
  });

  it('keeps an absent player parameter as the default account route', async () => {
    renderWorkspace('/?view=matches');

    expect(await screen.findByText('Active account 77')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('?view=matches POP');
  });
});
