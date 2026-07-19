import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const mocks = vi.hoisted(() => ({ signedIn: false }));

vi.mock('@clerk/react', () => ({
  Show: ({ when, children }: { when: 'signed-in' | 'signed-out'; children: ReactNode }) => (
    (when === 'signed-in') === mocks.signedIn ? children : null
  ),
  SignInButton: ({ children }: { children: ReactNode }) => children,
  UserButton: () => <span>User menu</span>,
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

    expect(screen.getByRole('heading', { name: /Разберите матч/i })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Открыть матч по ID' })).toBeVisible();
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

    expect(screen.getByRole('button', { name: 'Войти' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Ваш архив защищён входом' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Войти в архив' })).toBeVisible();
  });

  it('links an authenticated user to the personal archive', () => {
    mocks.signedIn = true;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <App clerkEnabled />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('link', { name: 'Мой архив' })).toHaveAttribute('href', '/archive');
    expect(screen.getByText('User menu')).toBeVisible();
  });
});
