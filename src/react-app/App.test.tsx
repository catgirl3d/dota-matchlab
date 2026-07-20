import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { render } from './test/setup';

const mocks = vi.hoisted(() => ({ signedIn: false }));

vi.mock('@clerk/react', () => ({
  Show: ({ when, children }: { when: 'signed-in' | 'signed-out'; children: ReactNode }) => (
    (when === 'signed-in') === mocks.signedIn ? children : null
  ),
  SignInButton: ({ children }: { children: ReactNode }) => children,
  UserButton: () => <span>User menu</span>,
}));
vi.mock('./components/ArchiveShowcase', () => ({
  ArchiveShowcase: ({ dotaAccountId, fallback }: { dotaAccountId: number; fallback: ReactNode }) => (
    dotaAccountId === 78 ? fallback : <div>Public showcase {dotaAccountId}</div>
  ),
}));
vi.mock('./components/ArchiveShowcaseAlias', () => ({
  ArchiveShowcaseAlias: ({ slug }: { slug: string }) => <div>Alias {slug}</div>,
}));

beforeEach(() => {
  mocks.signedIn = false;
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App routes', () => {
  it('keeps the landing and match search public without Clerk configuration', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App clerkEnabled={false} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: /Parse every match/i })).toBeVisible();
    expect(screen.getByText('AUTH OFF')).toBeVisible();
  });

  it('shows sign-in in the header and guards the personal archive', () => {
    window.history.replaceState({}, '', '/archive');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <App clerkEnabled />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('link', { name: 'Demo' })).toHaveAttribute('href', '/demo');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Authentication Required' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign in to Archive' })).toBeVisible();
  });

  it('links an authenticated user to the personal archive', () => {
    mocks.signedIn = true;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <App clerkEnabled />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('link', { name: 'My Archive' })).toHaveAttribute('href', '/archive');
    expect(screen.getByText('User menu')).toBeVisible();
  });

  it('opens an explicit signed-out showcase before the archive gate', () => {
    window.history.replaceState({}, '', '/archive?player=77');
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App clerkEnabled /></QueryClientProvider>);
    expect(screen.getByText('Public showcase 77')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Authentication Required' })).not.toBeInTheDocument();
  });

  it('keeps a valid showcase available when Clerk is disabled', () => {
    window.history.replaceState({}, '', '/archive?player=77');
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App clerkEnabled={false} /></QueryClientProvider>);
    expect(screen.getByText('Public showcase 77')).toBeVisible();
    expect(screen.queryByText('Authentication is not configured for this environment.')).not.toBeInTheDocument();
  });

  it('wires /demo to the public showcase alias without a player ID', () => {
    window.history.replaceState({}, '', '/demo');
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App clerkEnabled /></QueryClientProvider>);
    expect(screen.getByText('Alias demo')).toBeVisible();
  });

  it('shows the Clerk gate when an explicit showcase is unavailable', () => {
    window.history.replaceState({}, '', '/archive?player=78');
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App clerkEnabled /></QueryClientProvider>);
    expect(screen.getByRole('heading', { name: 'Authentication Required' })).toBeVisible();
  });
});
