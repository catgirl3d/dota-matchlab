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

  it('separates custom date ranges in private and showcase caches', () => {
    const januaryRange = { ...DEFAULT_ARCHIVE_FILTERS, period: 'custom' as const, startDate: '2026-01-01', endDate: '2026-01-31' };
    const februaryRange = { ...januaryRange, startDate: '2026-02-01', endDate: '2026-02-28' };

    expect(archiveQueryKeys.overview('account-a', januaryRange)).not.toEqual(
      archiveQueryKeys.overview('account-a', februaryRange),
    );
    expect(archiveShowcaseQueryKeys.page(77, januaryRange, null)).not.toEqual(
      archiveShowcaseQueryKeys.page(77, februaryRange, null),
    );
  });
});
