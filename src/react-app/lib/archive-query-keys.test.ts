import { describe, expect, it } from 'vitest';
import { DEFAULT_ARCHIVE_FILTERS } from './archive-analytics';
import { archiveQueryKeys, archiveShowcaseQueryKeys } from './archive-query-keys';

describe('archive query keys', () => {
  it('separates overview and cursor pages by account and filters', () => {
    expect(archiveQueryKeys.root('account-a')).toEqual(['match-archive', 'account-a']);
    expect(archiveQueryKeys.overview('account-a', DEFAULT_ARCHIVE_FILTERS)).toEqual([
      'match-archive', 'account-a', 'overview', DEFAULT_ARCHIVE_FILTERS,
    ]);
    expect(archiveQueryKeys.page('account-a', { ...DEFAULT_ARCHIVE_FILTERS, result: 'wins' }, { startTime: null, matchId: 10 })).toEqual([
      'match-archive', 'account-a', 'page', { ...DEFAULT_ARCHIVE_FILTERS, result: 'wins' }, { startTime: null, matchId: 10 },
    ]);
  });

  it('keys a public alias independently from showcase data', () => {
    expect(archiveShowcaseQueryKeys.resolve('demo')).toEqual(['archive-showcase-alias', 'demo']);
  });
});
