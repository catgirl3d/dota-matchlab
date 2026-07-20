import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DotaApiError } from '../lib/dota-api';
import { render } from '../test/setup';
import { ArchiveSyncPanel } from './ArchiveSyncPanel';

afterEach(() => {
  cleanup();
});

describe('ArchiveSyncPanel', () => {
  it('explains partial progress and starts the next page', () => {
    const onSync = vi.fn();
    const onSyncAll = vi.fn();

    render(
      <ArchiveSyncPanel
        accountName="Analyst"
        result={{
          trackedAccountId: 'tracked-id',
          accountId: 123,
          fetchedMatches: 100,
          archivedMatches: 98,
          status: 'partial',
          backfillComplete: false,
          nextOffset: 100,
        }}
        isPending={false}
        isSyncingAll={false}
        fullSyncProgress={null}
        error={null}
        onSync={onSync}
        onSyncAll={onSyncAll}
      />,
    );

    expect(screen.getByText('PARTIAL')).toBeInTheDocument();
    expect(screen.getByText('98')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gather Match History' })).toBeVisible();
    expect(screen.getByText(/details are loaded manually/i)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Load one batch/i }));
    expect(onSync).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: /Parse all/i }));
    expect(onSyncAll).toHaveBeenCalledOnce();
  });

  it('shows a ready state and disables the button while syncing', () => {
    render(
      <ArchiveSyncPanel
        accountName="Analyst"
        result={{
          trackedAccountId: 'tracked-id',
          accountId: 123,
          fetchedMatches: 4,
          archivedMatches: 4,
          status: 'ready',
          backfillComplete: true,
          nextOffset: 0,
        }}
        isPending
        isSyncingAll={false}
        fullSyncProgress={null}
        error={null}
        onSync={vi.fn()}
        onSyncAll={vi.fn()}
      />,
    );

    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Syncing.../i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Parse all/i })).toBeDisabled();
    expect(screen.getByText(/reached the end of available history/i)).toBeInTheDocument();
  });

  it('shows aggregate progress while parsing the full history', () => {
    render(
      <ArchiveSyncPanel
        accountName="Analyst"
        isPending={false}
        isSyncingAll
        fullSyncProgress={{ completedBatches: 3, fetchedMatches: 1_500, nextOffset: 1_500 }}
        error={null}
        onSync={vi.fn()}
        onSyncAll={vi.fn()}
      />,
    );

    expect(screen.getByText(/Batches:/i)).toHaveTextContent(
      'Batches: 3 · fetched: 1500 · offset: 1500',
    );
    expect(screen.getByRole('button', { name: /Parsing history.../i })).toBeDisabled();
  });

  it('shows the Worker error message', () => {
    render(
      <ArchiveSyncPanel
        accountName="Analyst"
        isPending={false}
        isSyncingAll={false}
        fullSyncProgress={null}
        error={new DotaApiError('Provider-specific message', 'OPENDOTA_LIMIT_EXCEEDED')}
        onSync={vi.fn()}
        onSyncAll={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Provider-specific message',
    );
  });
});
