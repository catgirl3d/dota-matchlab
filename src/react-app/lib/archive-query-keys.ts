import type { ArchiveCursor } from './archive';
import type { ArchiveFilters } from './archive-analytics';

export const ARCHIVE_STALE_TIME_MS = 15 * 60_000;

export const archiveQueryKeys = {
  root: (trackedAccountId: string | undefined) => ['match-archive', trackedAccountId] as const,
  overview: (trackedAccountId: string | undefined, filters: ArchiveFilters) =>
    [...archiveQueryKeys.root(trackedAccountId), 'overview', filters] as const,
  page: (trackedAccountId: string | undefined, filters: ArchiveFilters, cursor: ArchiveCursor | null) =>
    [...archiveQueryKeys.root(trackedAccountId), 'page', filters, cursor] as const,
};

export const archiveShowcaseQueryKeys = {
  root: (dotaAccountId: number | null) => ['archive-showcase', dotaAccountId] as const,
  resolve: (slug: string) => ['archive-showcase-alias', slug] as const,
  overview: (dotaAccountId: number | null, filters: ArchiveFilters) =>
    [...archiveShowcaseQueryKeys.root(dotaAccountId), 'overview', filters] as const,
  page: (dotaAccountId: number | null, filters: ArchiveFilters, cursor: ArchiveCursor | null) =>
    [...archiveShowcaseQueryKeys.root(dotaAccountId), 'page', filters, cursor] as const,
};
