import {
  Show,
  SignInButton,
  UserButton,
  useSession,
} from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { hasSupabaseConfig } from '../lib/config';
import { createUserSupabaseClient } from '../lib/supabase';
import { useTranslation } from '../lib/i18n';

type AccessPanelProps = {
  clerkEnabled: boolean;
};

export function AccessPanel({ clerkEnabled }: AccessPanelProps) {
  const { t } = useTranslation();
  return (
    <section className="access-panel" aria-labelledby="access-heading">
      <div className="section-heading">
        <p className="eyebrow">ACCESS / 01</p>
        <h2 id="access-heading">{t('accessHeading')}</h2>
      </div>

      {!clerkEnabled ? <MissingClerkConfiguration /> : <ConfiguredAccess />}
    </section>
  );
}

function MissingClerkConfiguration() {
  const { t } = useTranslation();
  return (
    <div className="setup-message">
      <p className="setup-message__title">{t('setupTitle')}</p>
      <p>
        Add Clerk and Supabase keys to <code>.env.local</code> and{' '}
        <code>.dev.vars</code> to enable sign in.
      </p>
    </div>
  );
}

function ConfiguredAccess() {
  const { t } = useTranslation();
  return (
    <>
      <Show when="signed-out">
        <p className="access-copy">
          {t('accessCopy')}
        </p>
        <SignInButton mode="modal">
          <button className="primary-button" type="button">
            {t('signInToLab')}
            <span aria-hidden="true">↗</span>
          </button>
        </SignInButton>
      </Show>

      <Show when="signed-in">
        <SignedInAccess />
      </Show>
    </>
  );
}

function SignedInAccess() {
  const { session } = useSession();
  const { t } = useTranslation();
  const databaseProbe = useQuery({
    queryKey: ['supabase', 'rls', session?.id],
    enabled: false,
    retry: false,
    queryFn: async () => {
      if (!session) {
        throw new Error('Clerk session is not ready');
      }

      const supabase = createUserSupabaseClient(() => session.getToken());
      const { error } = await supabase
        .from('profiles')
        .select('clerk_user_id')
        .limit(1);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    },
  });

  return (
    <div className="signed-in-card">
      <div className="signed-in-card__identity">
        <UserButton />
        <div>
          <span className="micro-label">CLERK SESSION</span>
          <strong>{t('accessApproved')}</strong>
        </div>
      </div>

      <button
        className="secondary-button"
        type="button"
        disabled={!hasSupabaseConfig || databaseProbe.isFetching}
        onClick={() => databaseProbe.refetch()}
      >
        {databaseProbe.isFetching ? t('checkingRls') : t('checkDataAccess')}
      </button>

      {databaseProbe.isSuccess ? (
        <p className="probe-result probe-result--ok">{t('rlsQuerySuccess')}</p>
      ) : null}
      {databaseProbe.isError ? (
        <p className="probe-result probe-result--error">
          {databaseProbe.error.message}
        </p>
      ) : null}
    </div>
  );
}

