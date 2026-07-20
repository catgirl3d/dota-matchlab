import { describe, expect, it } from 'vitest';
import { formatArchiveMode, formatGameMode } from './game-mode';
import { translate, type TranslationKey } from './i18n';

const t = (key: TranslationKey) => translate('en', key);

describe('game mode formatting', () => {
  it('uses shared localized labels for match records and filters', () => {
    expect(formatGameMode(1, t)).toBe('All Pick');
    expect(formatGameMode(22, t)).toBe('Ranked All Pick');
    expect(formatGameMode(23, t)).toBe('Turbo');
    expect(formatGameMode(null, t)).toBe('Other mode');
    expect(formatArchiveMode('ranked', t)).toBe('Ranked');
  });
});
