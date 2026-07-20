import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArchiveShowcaseAlias } from './ArchiveShowcaseAlias';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('@tanstack/react-query', () => ({ useQuery: mocks.query }));
vi.mock('../lib/archive', () => ({ resolveArchiveShowcase: vi.fn() }));
vi.mock('../lib/supabase', () => ({ createPublicSupabaseClient: () => ({}) }));

function LocationProbe() {
  const location = useLocation();
  const navigationType = useNavigationType();
  return <output data-testid="location">{location.pathname}{location.search} {navigationType}</output>;
}

function renderAlias() {
  return render(
    <MemoryRouter initialEntries={['/demo']}>
      <LocationProbe />
      <ArchiveShowcaseAlias slug="demo" />
    </MemoryRouter>,
  );
}

describe('ArchiveShowcaseAlias', () => {
  beforeEach(() => mocks.query.mockReset());
  afterEach(cleanup);

  it('shows a loading state while resolving the alias', () => {
    mocks.query.mockReturnValue({ isPending: true, error: null, data: undefined });
    renderAlias();
    expect(screen.getByText('Opening public archive...')).toBeVisible();
  });

  it('replaces the alias with the resolved archive player target', async () => {
    mocks.query.mockReturnValue({ isPending: false, error: null, data: 77 });
    renderAlias();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/archive?player=77 REPLACE'));
  });

  it('shows a missing state when the alias is not curated', async () => {
    mocks.query.mockReturnValue({ isPending: false, error: null, data: null });
    renderAlias();
    expect(await screen.findByText('Public archive not found.')).toBeVisible();
  });


  it('shows resolver errors', async () => {
    mocks.query.mockReturnValue({ isPending: false, error: new Error('RPC unavailable'), data: undefined });
    renderAlias();
    expect(await screen.findByText('RPC unavailable')).toBeVisible();
  });
});
