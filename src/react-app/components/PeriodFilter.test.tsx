import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PeriodFilter } from './PeriodFilter';

afterEach(cleanup);

describe('PeriodFilter', () => {
  it('commits a complete custom UTC range atomically', () => {
    const onChange = vi.fn();
    render(<PeriodFilter period="all" startDate={null} endDate={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Period: All time' }));
    const applyRange = screen.getByRole('button', { name: 'Apply range' });
    expect(applyRange).toBeDisabled();

    fireEvent.change(screen.getByLabelText('From date (UTC)'), { target: { value: '2026-01-10' } });
    fireEvent.change(screen.getByLabelText('To date (UTC)'), { target: { value: '2026-02-20' } });
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

  it('rejects an inverted date range', () => {
    const onChange = vi.fn();
    render(<PeriodFilter period="all" startDate={null} endDate={null} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Period: All time' }));
    fireEvent.change(screen.getByLabelText('From date (UTC)'), { target: { value: '2026-02-20' } });
    fireEvent.change(screen.getByLabelText('To date (UTC)'), { target: { value: '2026-02-10' } });

    expect(screen.getByText('Start date must be on or before end date')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Apply range' })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
