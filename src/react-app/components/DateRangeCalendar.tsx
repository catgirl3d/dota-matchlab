import { useState } from 'react';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

type DateRangeCalendarProps = {
  startDate: string;
  endDate: string;
  onChange: (startDate: string, endDate: string) => void;
};

type CalendarMonth = {
  year: number;
  month: number;
};

export function DateRangeCalendar({ startDate, endDate, onChange }: DateRangeCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => getCalendarMonth(startDate || endDate));
  const [isMonthNavigatorOpen, setIsMonthNavigatorOpen] = useState(false);
  const days = getCalendarDays(visibleMonth);

  function selectDate(date: string) {
    if (startDate === '' || endDate !== '') {
      onChange(date, '');
      return;
    }

    onChange(date < startDate ? date : startDate, date < startDate ? startDate : date);
  }

  return (
    <div className="date-range-calendar">
      <div className="date-range-calendar__selection">
        <DateSelection label="From" value={startDate} placeholder="Select date" />
        <DateSelection label="To" value={endDate} placeholder="Select date" />
      </div>
      <div className="date-range-calendar__toolbar">
        <button
          className="date-range-calendar__month-button"
          type="button"
          aria-label="Previous month"
          onClick={() => setVisibleMonth((month) => shiftMonth(month, -1))}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          className="date-range-calendar__month-label"
          type="button"
          aria-expanded={isMonthNavigatorOpen}
          aria-label="Choose month and year"
          onClick={() => setIsMonthNavigatorOpen((open) => !open)}
        >
          {formatMonth(visibleMonth)}
        </button>
        <button
          className="date-range-calendar__month-button"
          type="button"
          aria-label="Next month"
          onClick={() => setVisibleMonth((month) => shiftMonth(month, 1))}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      {isMonthNavigatorOpen ? (
        <div className="date-range-calendar__month-navigator" role="group" aria-label="Choose month">
          <div className="date-range-calendar__year-toolbar">
            <button
              className="date-range-calendar__year-button"
              type="button"
              aria-label="Previous year"
              onClick={() => setVisibleMonth((month) => ({ ...month, year: month.year - 1 }))}
            >
              <span aria-hidden="true">‹</span>
            </button>
            <strong>{visibleMonth.year}</strong>
            <button
              className="date-range-calendar__year-button"
              type="button"
              aria-label="Next year"
              onClick={() => setVisibleMonth((month) => ({ ...month, year: month.year + 1 }))}
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <div className="date-range-calendar__months">
            {Array.from({ length: 12 }, (_, month) => (
              <button
                className="date-range-calendar__month"
                type="button"
                key={month}
                aria-label={`Select ${formatMonthName(month)} ${visibleMonth.year}`}
                data-selected={month === visibleMonth.month}
                onClick={() => {
                  setVisibleMonth((currentMonth) => ({ ...currentMonth, month }));
                  setIsMonthNavigatorOpen(false);
                }}
              >
                {formatMonthName(month, 'short')}
              </button>
            ))}
          </div>
          <button
            className="date-range-calendar__today"
            type="button"
            onClick={() => {
              setVisibleMonth(getCalendarMonth(''));
              setIsMonthNavigatorOpen(false);
            }}
          >
            Current month
          </button>
        </div>
      ) : (
        <>
          <div className="date-range-calendar__weekdays" aria-hidden="true">
            {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="date-range-calendar__days" role="group" aria-label="Choose date range">
            {days.map((date, index) => {
              if (date === null) return <span className="date-range-calendar__blank" key={`blank-${index}`} />;

              const isRangeStart = date === startDate;
              const isRangeEnd = date === endDate;
              const isInRange = startDate !== '' && endDate !== '' && date > startDate && date < endDate;
              return (
                <button
                  className="date-range-calendar__day"
                  type="button"
                  key={date}
                  aria-label={`Select ${date}`}
                  aria-pressed={isRangeStart || isRangeEnd}
                  data-range-start={isRangeStart}
                  data-range-end={isRangeEnd}
                  data-in-range={isInRange}
                  onClick={() => selectDate(date)}
                >
                  {Number(date.slice(-2))}
                </button>
              );
            })}
          </div>
        </>
      )}
      <button
        className="date-range-calendar__clear"
        type="button"
        disabled={startDate === '' && endDate === ''}
        onClick={() => onChange('', '')}
      >
        Clear dates
      </button>
    </div>
  );
}

function DateSelection({ label, value, placeholder }: { label: string; value: string; placeholder: string }) {
  return (
    <span className="date-range-calendar__selected-date" data-selected={value !== ''}>
      <span>{label}</span>
      <strong>{value === '' ? placeholder : formatDate(value)}</strong>
    </span>
  );
}

function getCalendarMonth(value: string): CalendarMonth {
  if (value !== '') {
    const [year, month] = value.split('-').map(Number);
    if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
      return { year, month: month - 1 };
    }
  }

  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() };
}

function getCalendarDays({ year, month }: CalendarMonth): Array<string | null> {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: cells }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day < 1 || day > daysInMonth ? null : toIsoDate(year, month, day);
  });
}

function shiftMonth({ year, month }: CalendarMonth, direction: -1 | 1): CalendarMonth {
  const nextMonth = month + direction;
  return nextMonth < 0
    ? { year: year - 1, month: 11 }
    : nextMonth > 11
      ? { year: year + 1, month: 0 }
      : { year, month: nextMonth };
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatMonth({ year, month }: CalendarMonth): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month, 1)));
}

function formatMonthName(month: number, length: 'long' | 'short' = 'long'): string {
  return new Intl.DateTimeFormat('en-GB', { month: length, timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, month, 1)));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}
