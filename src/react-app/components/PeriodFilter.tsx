import { useEffect, useRef, useState } from 'react';
import type { ArchiveFilters, ArchivePeriod } from '../lib/archive-analytics';
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
  const [draftStartDate, setDraftStartDate] = useState(startDate ?? '');
  const [draftEndDate, setDraftEndDate] = useState(endDate ?? '');
  const filterRef = useRef<HTMLDivElement>(null);
  const selectedLabel = period === 'custom'
    ? 'Custom range'
    : PERIOD_OPTIONS.find(([value]) => value === period)?.[1] ?? 'All time';
  const rangeError = getRangeError(draftStartDate, draftEndDate);
  const canApplyRange = draftStartDate !== '' && draftEndDate !== '' && rangeError === null;

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
      setDraftStartDate(startDate ?? '');
      setDraftEndDate(endDate ?? '');
      document.dispatchEvent(new Event(FILTER_DROPDOWN_OPEN_EVENT));
    }
    setIsOpen((open) => !open);
  }

  function selectPreset(nextPeriod: Exclude<ArchivePeriod, 'custom'>) {
    onChange({ period: nextPeriod, startDate: null, endDate: null });
    setIsOpen(false);
  }

  function applyRange() {
    if (!canApplyRange) return;

    onChange({ period: 'custom', startDate: draftStartDate, endDate: draftEndDate });
    setIsOpen(false);
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
          <div className="period-filter__range" data-active={period === 'custom'}>
            <span className="period-filter__range-label">Custom range / UTC</span>
            <div className="period-filter__fields">
              <label>
                <span>From</span>
                <input
                  type="date"
                  value={draftStartDate}
                  max={draftEndDate || undefined}
                  aria-label="From date (UTC)"
                  onChange={(event) => setDraftStartDate(event.target.value)}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  type="date"
                  value={draftEndDate}
                  min={draftStartDate || undefined}
                  aria-label="To date (UTC)"
                  onChange={(event) => setDraftEndDate(event.target.value)}
                />
              </label>
            </div>
            {rangeError ? <span className="period-filter__error">{rangeError}</span> : null}
            <button className="period-filter__apply" type="button" disabled={!canApplyRange} onClick={applyRange}>
              Apply range
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getRangeError(startDate: string, endDate: string): string | null {
  if (startDate === '' && endDate === '') return null;
  if (startDate === '' || endDate === '') return 'Set both dates';
  if (startDate > endDate) return 'Start date must be on or before end date';
  return null;
}
