import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../test/setup';
import { PeriodFilter } from './PeriodFilter';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PeriodFilter', () => {
  it('commits a complete custom UTC range atomically', () => {
    const onChange = vi.fn();
    render(<PeriodFilter period="all" startDate={null} endDate={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Period: All time' }));
    fireEvent.click(screen.getByRole('button', { name: /Custom range/ }));
    expect(screen.getByRole('dialog', { name: 'Custom date range' })).toBeVisible();
    const applyRange = screen.getByRole('button', { name: 'Apply range' });
    expect(applyRange).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Select 2026-01-10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select 2026-02-20' }));
    expect(applyRange).toBeEnabled();

    fireEvent.click(applyRange);
    expect(onChange).toHaveBeenCalledWith({
      period: 'custom',
      startDate: '2026-01-10',
      endDate: '2026-02-20',
    });
    expect(screen.queryByRole('group', { name: 'Period options' })).not.toBeInTheDocument();
  });

  it('clears custom dates when a preset is selected', () => {
    const onChange = vi.fn();
    render(<PeriodFilter period="custom" startDate="2026-01-10" endDate="2026-02-20" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Period: Custom range' }));
    fireEvent.click(screen.getByRole('button', { name: 'Last 30 days' }));

    expect(onChange).toHaveBeenCalledWith({ period: '30d', startDate: null, endDate: null });
  });

  it('orders dates when the second selection precedes the first', () => {
    const onChange = vi.fn();
    render(<PeriodFilter period="all" startDate={null} endDate={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Period: All time' }));
    fireEvent.click(screen.getByRole('button', { name: /Custom range/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Select 2026-01-20' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select 2026-01-10' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply range' }));

    expect(onChange).toHaveBeenCalledWith({
      period: 'custom',
      startDate: '2026-01-10',
      endDate: '2026-01-20',
    });
  });
});
