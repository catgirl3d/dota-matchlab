import { useEffect, useRef, useState } from 'react';

export const FILTER_DROPDOWN_OPEN_EVENT = 'filter-dropdown:open';

type FilterDropdownProps = {
  label: string;
  value: string;
  options: ReadonlyArray<readonly [string, string]>;
  onChange: (value: string) => void;
  searchable?: boolean;
};

export function FilterDropdown({ label, value, options, onChange, searchable = false }: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectedLabel = options.find(([optionValue]) => optionValue === value)?.[1] ?? 'Select';
  const visibleOptions = searchable && searchQuery
    ? options.filter(([, optionLabel]) => optionLabel.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  useEffect(() => {
    if (!isOpen) return;

    searchInputRef.current?.focus();
    const closeDropdown = () => {
      setIsOpen(false);
      setSearchQuery('');
    };
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !dropdownRef.current?.contains(event.target)) {
        closeDropdown();
      }
    };

    document.addEventListener(FILTER_DROPDOWN_OPEN_EVENT, closeDropdown);
    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    return () => {
      document.removeEventListener(FILTER_DROPDOWN_OPEN_EVENT, closeDropdown);
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
    };
  }, [isOpen]);

  function toggleDropdown() {
    if (!isOpen) {
      document.dispatchEvent(new Event(FILTER_DROPDOWN_OPEN_EVENT));
    } else {
      setSearchQuery('');
    }
    setIsOpen((open) => !open);
  }

  return (
    <div className={`filter-select${isOpen ? ' filter-select--open' : ''}`} ref={dropdownRef}>
      <span>{label}</span>
      <button
        className="filter-dropdown__trigger"
        type="button"
        aria-expanded={isOpen}
        aria-label={`${label}: ${selectedLabel}`}
        onClick={toggleDropdown}
      >
        {selectedLabel}
      </button>
      {isOpen ? (
        <div className="filter-dropdown__menu" role="group" aria-label={`${label} options`}>
          {searchable ? (
            <div className="filter-dropdown__search">
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                placeholder={`Search ${label.toLowerCase()}...`}
                aria-label={`Search ${label.toLowerCase()}`}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          ) : null}
          {visibleOptions.length === 0 ? <span className="filter-dropdown__empty">No matches</span> : null}
          {visibleOptions.map(([optionValue, optionLabel]) => {
            const isSelected = optionValue === value;
            return (
              <button
                className="filter-dropdown__option"
                data-selected={isSelected}
                type="button"
                key={optionValue}
                onClick={() => {
                  onChange(optionValue);
                  setIsOpen(false);
                  setSearchQuery('');
                }}
              >
                {optionLabel}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
