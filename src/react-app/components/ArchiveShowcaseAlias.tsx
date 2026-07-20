import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router';
import { resolveArchiveShowcase } from '../lib/archive';
import { archiveShowcaseQueryKeys } from '../lib/archive-query-keys';
import { createPublicSupabaseClient } from '../lib/supabase';
import { useTranslation } from '../lib/i18n';

type ArchiveShowcaseAliasProps = {
  slug: string;
};

export function ArchiveShowcaseAlias({ slug }: ArchiveShowcaseAliasProps) {
  const { t } = useTranslation();
  const showcaseQuery = useQuery<number | null>({
    queryKey: archiveShowcaseQueryKeys.resolve(slug),
    retry: false,
    queryFn: ({ signal }) => resolveArchiveShowcase(createPublicSupabaseClient(), slug, signal),
  });

  if (showcaseQuery.isPending) {
    return <div className="workspace-message workspace-message--neutral"><span aria-hidden="true">+</span><p>{t('openingPublicArchive')}</p></div>;
  }
  if (showcaseQuery.error) {
    return <div className="workspace-message workspace-message--error"><span aria-hidden="true">!</span><p>{showcaseQuery.error.message}</p></div>;
  }
  if (showcaseQuery.data === null) {
    return <div className="workspace-message workspace-message--error"><span aria-hidden="true">!</span><p>{t('publicArchiveNotFound')}</p></div>;
  }

  return <Navigate replace to={`/archive?player=${showcaseQuery.data}`} />;
}

