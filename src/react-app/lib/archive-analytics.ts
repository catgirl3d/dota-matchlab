export type ArchivePeriod = 'all' | '30d' | '90d' | 'year';
export type ArchiveMode = 'all' | 'ranked' | 'turbo' | 'all-pick';
export type ArchiveResult = 'all' | 'wins' | 'losses';
export type ArchiveParty = 'all' | 'solo' | 'party';
export type ArchivePosition = 'all' | 'carry' | 'mid' | 'offlane' | 'support' | 'hard-support';

export type ArchiveFilters = {
  period: ArchivePeriod;
  mode: ArchiveMode;
  result: ArchiveResult;
  party: ArchiveParty;
  position: ArchivePosition;
  heroId: number | null;
};

export const DEFAULT_ARCHIVE_FILTERS: ArchiveFilters = {
  period: 'all',
  mode: 'all',
  result: 'all',
  party: 'all',
  position: 'all',
  heroId: null,
};

const MODE_LABELS: Record<ArchiveMode, string> = {
  all: 'Все режимы',
  ranked: 'Ranked',
  turbo: 'Turbo',
  'all-pick': 'All Pick',
};

const POSITION_LABELS: Record<ArchivePosition, string> = {
  all: 'Все позиции',
  carry: 'Carry',
  mid: 'Mid',
  offlane: 'Offlane',
  support: 'Soft support',
  'hard-support': 'Hard support',
};

export function getModeLabelForFilter(mode: ArchiveMode): string {
  return MODE_LABELS[mode];
}

export function getPositionLabelForFilter(position: ArchivePosition): string {
  return POSITION_LABELS[position];
}
