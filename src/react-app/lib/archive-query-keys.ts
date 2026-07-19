import type { ArchiveCursor } from './archive';
import type { ArchiveFilters } from './archive-analytics';

export const archiveQueryKeys = {
  root: (trackedAccountId: string | undefined) => ['match-archive', trackedAccountId] as const,
  overview: (trackedAccountId: string | undefined, filters: ArchiveFilters) =>
    [...archiveQueryKeys.root(trackedAccountId), 'overview', filters] as const,
  page: (trackedAccountId: string | undefined, filters: ArchiveFilters, cursor: ArchiveCursor | null) =>
    [...archiveQueryKeys.root(trackedAccountId), 'page', filters, cursor] as const,
};
