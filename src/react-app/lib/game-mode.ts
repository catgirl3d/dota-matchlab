import type { ArchiveMode } from './archive-analytics';
import type { TranslationKey } from './i18n';

type Translate = (key: TranslationKey) => string;

const gameModeKeys: Record<number, TranslationKey> = {
  1: 'gameModeAllPick',
  22: 'gameModeRankedAllPick',
  23: 'gameModeTurbo',
};

const archiveModeKeys: Record<ArchiveMode, TranslationKey> = {
  all: 'allModes',
  ranked: 'gameModeRanked',
  turbo: 'gameModeTurbo',
  'all-pick': 'gameModeAllPick',
};

export function formatGameMode(mode: number | null, t: Translate): string {
  return t(gameModeKeys[mode ?? -1] ?? 'otherMode');
}

export function formatArchiveMode(mode: ArchiveMode, t: Translate): string {
  return t(archiveModeKeys[mode]);
}
