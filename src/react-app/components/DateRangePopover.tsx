import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DateRangeCalendar } from './DateRangeCalendar';

type DateRangePopoverProps = {
  startDate: string | null;
  endDate: string | null;
  onApply: (startDate: string, endDate: string) => void;
  onClose: () => void;
};

export function DateRangePopover({ startDate, endDate, onApply, onClose }: DateRangePopoverProps) {
  const [draftStartDate, setDraftStartDate] = useState(startDate ?? '');
  const [draftEndDate, setDraftEndDate] = useState(endDate ?? '');
  const canApplyRange = draftStartDate !== '' && draftEndDate !== '' && draftStartDate <= draftEndDate;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="date-range-popover"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="date-range-popover__panel" role="dialog" aria-modal="true" aria-label="Custom date range">
        <header className="date-range-popover__header">
          <div>
            <span className="micro-label">CUSTOM RANGE / UTC</span>
            <strong>Choose dates</strong>
          </div>
          <button className="date-range-popover__close" type="button" aria-label="Close custom date range" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <DateRangeCalendar
          startDate={draftStartDate}
          endDate={draftEndDate}
          onChange={(nextStartDate, nextEndDate) => {
            setDraftStartDate(nextStartDate);
            setDraftEndDate(nextEndDate);
          }}
        />
        <footer className="date-range-popover__actions">
          <button className="date-range-popover__cancel" type="button" onClick={onClose}>Cancel</button>
          <button
            className="date-range-popover__apply"
            type="button"
            disabled={!canApplyRange}
            onClick={() => onApply(draftStartDate, draftEndDate)}
          >
            Apply range
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
