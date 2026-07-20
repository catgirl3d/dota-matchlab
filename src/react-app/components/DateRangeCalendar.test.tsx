import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '../test/setup';
import { DateRangeCalendar } from './DateRangeCalendar';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('DateRangeCalendar', () => {
  it('jumps directly to a month in another year', () => {
    render(<DateRangeCalendar startDate="" endDate="" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Choose month and year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next year' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select March 2027' }));

    expect(screen.queryByRole('group', { name: 'Choose month' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select 2027-03-01' })).toBeVisible();
  });
});
