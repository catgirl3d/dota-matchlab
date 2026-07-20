import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router';
import { resolveArchiveShowcase } from '../lib/archive';
import { archiveShowcaseQueryKeys } from '../lib/archive-query-keys';
import { createPublicSupabaseClient } from '../lib/supabase';

type ArchiveShowcaseAliasProps = {
  slug: string;
};

export function ArchiveShowcaseAlias({ slug }: ArchiveShowcaseAliasProps) {
  const showcaseQuery = useQuery<number | null>({
    queryKey: archiveShowcaseQueryKeys.resolve(slug),
    retry: false,
    queryFn: ({ signal }) => resolveArchiveShowcase(createPublicSupabaseClient(), slug, signal),
  });

  if (showcaseQuery.isPending) {
    return <div className="workspace-message workspace-message--neutral"><span aria-hidden="true">+</span><p>Открываем публичный архив…</p></div>;
  }
  if (showcaseQuery.error) {
    return <div className="workspace-message workspace-message--error"><span aria-hidden="true">!</span><p>{showcaseQuery.error.message}</p></div>;
  }
  if (showcaseQuery.data === null) {
    return <div className="workspace-message workspace-message--error"><span aria-hidden="true">!</span><p>Публичный архив не найден.</p></div>;
  }

  return <Navigate replace to={`/archive?player=${showcaseQuery.data}`} />;
}
