export type PlayerSort = 'slot' | 'imp' | 'netWorth' | 'heroDamage' | 'towerDamage';

const PLAYER_SORT_OPTIONS: Array<{ value: PlayerSort; label: string; title: string }> = [
  { value: 'slot', label: 'Order', title: 'Original player order' },
  { value: 'imp', label: 'IMP', title: 'Sort by Individual Match Performance' },
  { value: 'netWorth', label: 'NET', title: 'Sort by net worth' },
  { value: 'heroDamage', label: 'Hero damage', title: 'Sort by hero damage' },
  { value: 'towerDamage', label: 'Tower damage', title: 'Sort by tower damage' },
];

type PlayerSortControlsProps = {
  value: PlayerSort;
  onChange: (value: PlayerSort) => void;
  ariaLabel: string;
};

export function PlayerSortControls({ value, onChange, ariaLabel }: PlayerSortControlsProps) {
  return (
    <div className="player-sort" role="group" aria-label={ariaLabel}>
      <span className="micro-label">SORT BY / DESCENDING</span>
      <div className="player-sort__options">
        {PLAYER_SORT_OPTIONS.map((option) => (
          <Tooltip content={option.title} focusable={false} key={option.value}>
            <button
              className={value === option.value ? 'is-active' : ''}
              type="button"
              aria-pressed={value === option.value}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
import { Tooltip } from './Tooltip';
