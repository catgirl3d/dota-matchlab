import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App bootstrap state', () => {
  it('shows setup instructions and the live service state without Clerk keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          status: 'degraded',
          checkedAt: '2026-07-18T20:35:00.000Z',
          services: {
            worker: 'ok',
            supabase: { status: 'not_configured', latencyMs: 0 },
          },
        }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App clerkEnabled={false} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: /Разберите матч/i })).toBeVisible();
    expect(screen.getByText('Каркас готов')).toBeVisible();
    expect(await screen.findByText('Cloudflare Worker')).toBeVisible();
    expect(await screen.findByText('Supabase RPC')).toBeVisible();
    expect(await screen.findByText('не настроено')).toBeVisible();
  });
});
