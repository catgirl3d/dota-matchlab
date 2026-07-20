import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function renderShowcase() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ArchiveShowcase dotaAccountId={77} fallback={<div>Unavailable</div>} /></QueryClientProvider>);
}

describe('ArchiveShowcase', () => {
  it('renders public data without sync controls', async () => {
    mocks.overview.mockResolvedValue({ account: { dotaAccountId: 77, personaName: 'Curated', avatarUrl: null, rankTier: null, profileRefreshedAt: null }, overview: {} });
    mocks.page.mockResolvedValue({ matches: [], nextCursor: null });
    renderShowcase();
    expect(await screen.findByText('Showcase 77 read-only')).toBeVisible();
    expect(screen.getByLabelText('Public player archive')).toHaveClass('match-workspace--showcase');
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
