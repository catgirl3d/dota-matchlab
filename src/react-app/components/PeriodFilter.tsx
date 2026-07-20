import { useEffect, useRef, useState } from 'react';
import type { ArchiveFilters, ArchivePeriod } from '../lib/archive-analytics';
import { DateRangePopover } from './DateRangePopover';
import { FILTER_DROPDOWN_OPEN_EVENT } from './FilterDropdown';

const PERIOD_OPTIONS = [
  ['all', 'All time'],
  ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'],
  ['year', 'Last year'],
] as const;

type PeriodFilterProps = Pick<ArchiveFilters, 'period' | 'startDate' | 'endDate'> & {
  onChange: (period: Pick<ArchiveFilters, 'period' | 'startDate' | 'endDate'>) => void;
};

export function PeriodFilter({ period, startDate, endDate, onChange }: PeriodFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRangePopoverOpen, setIsRangePopoverOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const selectedLabel = period === 'custom'
    ? 'Custom range'
    : PERIOD_OPTIONS.find(([value]) => value === period)?.[1] ?? 'All time';

  useEffect(() => {
    if (!isOpen) return;

    const closeFilter = () => setIsOpen(false);
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !filterRef.current?.contains(event.target)) {
        closeFilter();
      }
    };

    document.addEventListener(FILTER_DROPDOWN_OPEN_EVENT, closeFilter);
    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    return () => {
      document.removeEventListener(FILTER_DROPDOWN_OPEN_EVENT, closeFilter);
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
    };
  }, [isOpen]);

  function toggleFilter() {
    if (!isOpen) {
      document.dispatchEvent(new Event(FILTER_DROPDOWN_OPEN_EVENT));
    }
    setIsOpen((open) => !open);
  }

  function selectPreset(nextPeriod: Exclude<ArchivePeriod, 'custom'>) {
    onChange({ period: nextPeriod, startDate: null, endDate: null });
    setIsOpen(false);
  }

  function openRangePopover() {
    setIsOpen(false);
    setIsRangePopoverOpen(true);
  }

  return (
    <div className={`filter-select${isOpen ? ' filter-select--open' : ''}`} ref={filterRef}>
      <span>Period</span>
      <button
        className="filter-dropdown__trigger"
        type="button"
        aria-expanded={isOpen}
        aria-label={`Period: ${selectedLabel}`}
        onClick={toggleFilter}
      >
        {selectedLabel}
      </button>
      {isOpen ? (
        <div className="filter-dropdown__menu period-filter__menu" role="group" aria-label="Period options">
          {PERIOD_OPTIONS.map(([optionValue, optionLabel]) => (
            <button
              className="filter-dropdown__option"
              data-selected={period === optionValue}
              type="button"
              key={optionValue}
              onClick={() => selectPreset(optionValue)}
            >
              {optionLabel}
            </button>
          ))}
          <button className="period-filter__custom-trigger" type="button" data-selected={period === 'custom'} onClick={openRangePopover}>
            <span>Custom range</span>
            <span>{period === 'custom' ? 'Edit dates' : 'Choose dates'}</span>
          </button>
        </div>
      ) : null}
      {isRangePopoverOpen ? (
        <DateRangePopover
          startDate={startDate}
          endDate={endDate}
          onClose={() => setIsRangePopoverOpen(false)}
          onApply={(nextStartDate, nextEndDate) => {
            onChange({ period: 'custom', startDate: nextStartDate, endDate: nextEndDate });
            setIsRangePopoverOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
