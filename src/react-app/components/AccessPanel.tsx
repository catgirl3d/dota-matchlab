import {
  Show,
  SignInButton,
  UserButton,
  useSession,
} from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { hasSupabaseConfig } from '../lib/config';
import { createUserSupabaseClient } from '../lib/supabase';

type AccessPanelProps = {
  clerkEnabled: boolean;
};

export function AccessPanel({ clerkEnabled }: AccessPanelProps) {
  return (
    <section className="access-panel" aria-labelledby="access-heading">
      <div className="section-heading">
        <p className="eyebrow">ACCESS / 01</p>
        <h2 id="access-heading">Закрытая лаборатория</h2>
      </div>

      {!clerkEnabled ? <MissingClerkConfiguration /> : <ConfiguredAccess />}
    </section>
  );
}

function MissingClerkConfiguration() {
  return (
    <div className="setup-message">
      <p className="setup-message__title">Каркас готов</p>
      <p>
        Добавьте ключи Clerk и Supabase в <code>.env.local</code> и{' '}
        <code>.dev.vars</code>, чтобы включить реальный вход.
      </p>
    </div>
  );
}

function ConfiguredAccess() {
  return (
    <>
      <Show when="signed-out">
        <p className="access-copy">
          Вход открыт только участникам теста. Матчи и настройки каждого
          пользователя отделены политиками RLS.
        </p>
        <SignInButton mode="modal">
          <button className="primary-button" type="button">
            Войти в лабораторию
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
          <strong>Доступ подтверждён</strong>
        </div>
      </div>

      <button
        className="secondary-button"
        type="button"
        disabled={!hasSupabaseConfig || databaseProbe.isFetching}
        onClick={() => databaseProbe.refetch()}
      >
        {databaseProbe.isFetching ? 'Проверяем RLS…' : 'Проверить доступ к данным'}
      </button>

      {databaseProbe.isSuccess ? (
        <p className="probe-result probe-result--ok">RLS запрос выполнен</p>
      ) : null}
      {databaseProbe.isError ? (
        <p className="probe-result probe-result--error">
          {databaseProbe.error.message}
        </p>
      ) : null}
    </div>
  );
}
