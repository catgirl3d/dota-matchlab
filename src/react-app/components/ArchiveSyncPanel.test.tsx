import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArchiveSyncPanel } from './ArchiveSyncPanel';

afterEach(() => {
  cleanup();
});

describe('ArchiveSyncPanel', () => {
  it('explains partial progress and starts the next page', () => {
    const onSync = vi.fn();

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
        error={null}
        onSync={onSync}
      />,
    );

    expect(screen.getByText('PARTIAL')).toBeInTheDocument();
    expect(screen.getByText('98')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Синхронизировать страницу/i }));
    expect(onSync).toHaveBeenCalledOnce();
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
        error={null}
        onSync={vi.fn()}
      />,
    );

    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Синхронизируем/i })).toBeDisabled();
    expect(screen.getByText(/достигнут конец доступной истории/)).toBeInTheDocument();
  });
});
