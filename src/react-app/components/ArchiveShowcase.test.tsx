import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../test/setup';
import { ArchiveShowcase } from './ArchiveShowcase';

const mocks = vi.hoisted(() => ({ overview: vi.fn(), page: vi.fn() }));

vi.mock('../lib/archive', () => ({
  fetchArchiveShowcaseOverview: mocks.overview,
  fetchArchiveShowcasePage: mocks.page,
}));
vi.mock('../lib/dota-api', () => ({ fetchHeroNames: vi.fn().mockResolvedValue({}) }));
vi.mock('../lib/supabase', () => ({ createPublicSupabaseClient: () => ({}) }));
vi.mock('./PlayerDashboard', () => ({
  PlayerDashboard: ({ account, syncControls }: { account: { dota_account_id: number }; syncControls?: unknown }) => <div>Showcase {account.dota_account_id} {syncControls ? 'mutable' : 'read-only'}</div>,
}));

afterEach(cleanup);
beforeEach(() => {
  mocks.overview.mockReset();
  mocks.page.mockReset();
});

function renderShowcase(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}><ArchiveShowcase dotaAccountId={77} fallback={<div>Unavailable</div>} /></QueryClientProvider>),
  };
}

describe('ArchiveShowcase', () => {
  it('renders public data without sync controls', async () => {
    mocks.overview.mockResolvedValue({ account: { dotaAccountId: 77, personaName: 'Curated', avatarUrl: null, rankTier: null, profileRefreshedAt: null }, overview: {} });
    mocks.page.mockResolvedValue({ matches: [], nextCursor: null });
    renderShowcase();
    expect(await screen.findByText('Showcase 77 read-only')).toBeVisible();
    expect(screen.getByLabelText('Public player archive')).toHaveClass('match-workspace--showcase');
  });

  it('reuses fresh archive data after remounting', async () => {
    mocks.overview.mockResolvedValue({ account: { dotaAccountId: 77, personaName: 'Curated', avatarUrl: null, rankTier: null, profileRefreshedAt: null }, overview: {} });
    mocks.page.mockResolvedValue({ matches: [], nextCursor: null });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const firstRender = renderShowcase(queryClient);

    expect(await screen.findByText('Showcase 77 read-only')).toBeVisible();
    firstRender.unmount();
    renderShowcase(queryClient);

    expect(await screen.findByText('Showcase 77 read-only')).toBeVisible();
    expect(mocks.overview).toHaveBeenCalledTimes(1);
    expect(mocks.page).toHaveBeenCalledTimes(1);
  });


  it('uses the supplied fallback when the showcase is missing', async () => {
    mocks.overview.mockResolvedValue(null);
    mocks.page.mockResolvedValue(null);
    renderShowcase();
    expect(await screen.findByText('Unavailable')).toBeVisible();
  });

  it('renders RPC errors rather than an auth gate', async () => {
    mocks.overview.mockRejectedValue(new Error('RPC unavailable'));
    mocks.page.mockResolvedValue(null);
    renderShowcase();
    expect(await screen.findByText('RPC unavailable')).toBeVisible();
  });
});
