import { Show } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { AccessPanel } from './components/AccessPanel';
import { MatchWorkspace } from './components/MatchWorkspace';
import { SystemStatus } from './components/SystemStatus';
import { fetchSystemHealth } from './lib/api';

type AppProps = {
  clerkEnabled: boolean;
};

const workflow = [
  {
    number: '01',
    title: 'Профиль',
    text: 'Привязать Steam ID или добавить публичный профиль для наблюдения.',
  },
  {
    number: '02',
    title: 'Синхронизация',
    text: 'Забрать свежие матчи, не превышая квоты источника данных.',
  },
  {
    number: '03',
    title: 'Разбор',
    text: 'Сравнить темп, решения и повторяющиеся ошибки на дистанции.',
  },
] as const;

export default function App({ clerkEnabled }: AppProps) {
  const healthQuery = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchSystemHealth,
    retry: false,
    staleTime: 30_000,
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Dota MatchLab, главная">
          <span className="wordmark__mark" aria-hidden="true">
            M/L
          </span>
          <span>DOTA MATCHLAB</span>
        </a>
        <div className="release-tag">
          <span className="release-tag__pulse" aria-hidden="true" />
          PRIVATE ALPHA · 0.1
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy">
            <p className="eyebrow">MATCH INTELLIGENCE / EU</p>
            <h1 id="hero-title">
              Разберите матч
              <span>до последнего тайминга.</span>
            </h1>
            <p className="hero__lede">
              Личный архив, сравнительная аналитика и честный взгляд на серии
              матчей — без шума публичных рейтингов.
            </p>
          </div>

          <div className="hero__instrument" aria-hidden="true">
            <div className="instrument__axis instrument__axis--vertical" />
            <div className="instrument__axis instrument__axis--horizontal" />
            <span className="instrument__time">00:00</span>
            <span className="instrument__label">ANALYSIS WINDOW</span>
            <span className="instrument__coordinate">54.6872 / 25.2797</span>
          </div>
        </section>

        <section className="control-grid" aria-label="Диагностика MVP">
          <SystemStatus
            health={healthQuery.data}
            isLoading={healthQuery.isPending}
            isRefreshing={healthQuery.isFetching}
            hasError={healthQuery.isError}
            onRefresh={() => healthQuery.refetch()}
          />
          <AccessPanel clerkEnabled={clerkEnabled} />
        </section>

        {clerkEnabled ? (
          <Show when="signed-in">
            <MatchWorkspace />
          </Show>
        ) : null}

        <section className="workflow" aria-labelledby="workflow-title">
          <div className="workflow__intro">
            <p className="eyebrow">PIPELINE / NEXT</p>
            <h2 id="workflow-title">От аккаунта до вывода</h2>
          </div>
          <ol className="workflow__steps">
            {workflow.map((step) => (
              <li key={step.number} className="workflow-step">
                <span className="workflow-step__number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="footer">
        <span>INDEPENDENT ANALYSIS TOOL</span>
        <span>DATA PROVIDER: OPENDOTA · PLANNED</span>
      </footer>
    </div>
  );
}
