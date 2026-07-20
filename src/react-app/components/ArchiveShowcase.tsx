import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import {
  fetchArchiveShowcaseOverview,
  fetchArchiveShowcasePage,
  type ArchiveCursor,
  type ArchivePage,
  type ArchiveShowcaseOverview,
} from '../lib/archive';
import { DEFAULT_ARCHIVE_FILTERS, type ArchiveFilters } from '../lib/archive-analytics';
import { archiveShowcaseQueryKeys } from '../lib/archive-query-keys';
import { fetchHeroNames } from '../lib/dota-api';
import { createPublicSupabaseClient } from '../lib/supabase';
import { PlayerDashboard } from './PlayerDashboard';

type ArchiveShowcaseProps = {
  dotaAccountId: number;
  fallback: ReactNode;
};

function keepShowcaseData<T>(
  previousData: T | undefined,
  previousQuery: { queryKey: readonly unknown[] } | undefined,
  dotaAccountId: number,
): T | undefined {
  return previousQuery?.queryKey[1] === dotaAccountId ? previousData : undefined;
}

export function ArchiveShowcase({ dotaAccountId, fallback }: ArchiveShowcaseProps) {
  const [filters, setFilters] = useState<ArchiveFilters>(DEFAULT_ARCHIVE_FILTERS);
  const [cursors, setCursors] = useState<ArchiveCursor[]>([]);
  const cursor = cursors.at(-1) ?? null;
  const overviewQuery = useQuery<ArchiveShowcaseOverview | null>({
    queryKey: archiveShowcaseQueryKeys.overview(dotaAccountId, filters),
    staleTime: 60_000,
    retry: false,
    placeholderData: (previousData, previousQuery) => keepShowcaseData(previousData, previousQuery, dotaAccountId),
    queryFn: ({ signal }) => fetchArchiveShowcaseOverview(createPublicSupabaseClient(), dotaAccountId, filters, signal),
  });
  const pageQuery = useQuery<ArchivePage | null>({
    queryKey: archiveShowcaseQueryKeys.page(dotaAccountId, filters, cursor),
    staleTime: 60_000,
    retry: false,
    placeholderData: (previousData, previousQuery) => keepShowcaseData(previousData, previousQuery, dotaAccountId),
    queryFn: ({ signal }) => fetchArchiveShowcasePage(createPublicSupabaseClient(), dotaAccountId, filters, cursor, signal),
  });
  const heroNamesQuery = useQuery({
    queryKey: ['dota-hero-names'],
    staleTime: 86_400_000,
    gcTime: 86_400_000,
    queryFn: () => fetchHeroNames(),
  });

  if (overviewQuery.isPending || pageQuery.isPending) {
    return <div className="workspace-message workspace-message--neutral"><span aria-hidden="true">+</span><p>Загружаем публичный архив…</p></div>;
  }
  if (overviewQuery.error || pageQuery.error) {
    return <div className="workspace-message workspace-message--error"><span aria-hidden="true">!</span><p>{(overviewQuery.error ?? pageQuery.error)?.message}</p></div>;
  }
  if (!overviewQuery.data || !pageQuery.data) return <>{fallback}</>;

  const { account, overview } = overviewQuery.data;
  return <section className="match-workspace" aria-label="Публичный архив игрока">
    <PlayerDashboard
      account={{ dota_account_id: account.dotaAccountId, persona_name: account.personaName, avatar_url: account.avatarUrl, rank_tier: account.rankTier }}
      overview={overview}
      page={pageQuery.data}
      filters={filters}
      heroNames={heroNamesQuery.data ?? {}}
      isLoading={overviewQuery.isPending || pageQuery.isPending}
      isRefreshing={overviewQuery.isFetching || pageQuery.isFetching}
      error={null}
      onRefresh={() => { void overviewQuery.refetch(); void pageQuery.refetch(); }}
      onFiltersChange={(nextFilters) => { setFilters(nextFilters); setCursors([]); }}
      onNextPage={(nextCursor) => setCursors((current) => [...current, nextCursor])}
      onPreviousPage={() => setCursors((current) => current.slice(0, -1))}
      hasPreviousPage={cursors.length > 0}
    />
  </section>;
}
