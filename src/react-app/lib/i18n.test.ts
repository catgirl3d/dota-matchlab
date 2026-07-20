import { describe, expect, it } from 'vitest';
import { getPluralSuffix, translate } from './i18n';

describe('translations', () => {
  it('selects English plural forms from the raw count while rendering a formatted value', () => {
    expect(getPluralSuffix(1)).toBe('one');
    expect(getPluralSuffix(2)).toBe('other');
    expect(translate('en', 'matchesInView', { count: 1, formattedCount: '1' })).toBe('1 match in view');
    expect(translate('en', 'matchesInView', { count: 1_000, formattedCount: '1,000' })).toBe('1,000 matches in view');
  });
});
