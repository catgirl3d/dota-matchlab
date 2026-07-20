import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { parseMatchId } from '../lib/match-id';

const workflow = [
  {
    number: '01',
    title: 'Найдите',
    text: 'Введите match ID и откройте уже загруженный разбор без регистрации.',
  },
  {
    number: '02',
    title: 'Разберите',
    text: 'Изучите составы, темп, экономику, способности и ключевые события.',
  },
  {
    number: '03',
    title: 'Соберите архив',
    text: 'Войдите, чтобы привязать профиль и отслеживать серии матчей на дистанции.',
  },
] as const;

export function LandingPage() {
  const navigate = useNavigate();
  const [matchIdInput, setMatchIdInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const matchId = parseMatchId(matchIdInput);
    if (matchId === null) {
      setError('Введите корректный числовой match ID.');
      return;
    }

    navigate(`/matches/${matchId}`);
  }

  return (
    <>
      <section className="hero hero--landing" aria-labelledby="hero-title">
        <div className="hero__grid-bg" />
        <div className="hero__corner hero__corner--tl" />
        <div className="hero__corner hero__corner--tr" />
        <div className="hero__corner hero__corner--bl" />
        <div className="hero__corner hero__corner--br" />

        <div className="hero__copy">
          <div className="hero__status-badge">
            <span className="hero__status-ping" />
            <span className="hero__status-label">MATCH INTELLIGENCE / CORE_ACTIVE_SYS</span>
          </div>

          <h1 id="hero-title">
            Разберите матч
            <span>до последнего тайминга.</span>
          </h1>
          <p className="hero__lede">
            Scoreboard, темп, сборки и события матча в одном техническом отчёте.
            Уже загруженные матчи доступны без регистрации.
          </p>

          <form className="match-search" onSubmit={handleSubmit} noValidate>
            <div className="match-search__wrapper">
              <div className="match-search__header">
                <span className="match-search__syscode">SYS_REQ // AUTO_PARSE_ID</span>
                <span className="match-search__status">READY TO LOAD</span>
              </div>
              <div className="match-search__controls">
                <span className="match-search__prefix" aria-hidden="true">MATCH_ID</span>
                <input
                  id="match-id"
                  name="matchId"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="8749050591"
                  value={matchIdInput}
                  aria-label="Открыть матч по ID"
                  aria-invalid={error ? true : undefined}
                  aria-describedby="match-search-hint"
                  onChange={(event) => {
                    setMatchIdInput(event.target.value);
                    if (error) setError(null);
                  }}
                />
                <button type="submit">Открыть разбор</button>
              </div>
              <div className="match-search__footer">
                <p id="match-search-hint" className={error ? 'match-search__hint match-search__hint--error' : 'match-search__hint'}>
                  {error ?? '// Новый матч можно загрузить после входа.'}
                </p>
                <div className="match-search__example">
                  SYS_DEMO:{' '}
                  <button
                    type="button"
                    className="match-search__example-btn"
                    onClick={() => {
                      setMatchIdInput('8749050591');
                      setError(null);
                    }}
                  >
                    8749050591
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="hero__instrument-container">
          <div className="hero__instrument" aria-hidden="true">
            <div className="instrument__grid" />
            <div className="instrument__axis instrument__axis--vertical" />
            <div className="instrument__axis instrument__axis--horizontal" />
            
            <div className="instrument__pulse instrument__pulse--center" />
            <div className="instrument__dot instrument__dot--radiant" style={{ '--x': '30%', '--y': '40%' } as React.CSSProperties}>
              <span className="instrument__tooltip">Juggernaut</span>
            </div>
            <div className="instrument__dot instrument__dot--dire" style={{ '--x': '70%', '--y': '60%' } as React.CSSProperties}>
              <span className="instrument__tooltip">Shadow Fiend</span>
            </div>
            <div className="instrument__ring instrument__ring--outer" />
            <div className="instrument__ring instrument__ring--mid" />
            <div className="instrument__ring instrument__ring--inner" />
            <div className="instrument__sweep" />
            
            <div className="instrument__dot instrument__dot--1" style={{ '--x': '30%', '--y': '45%' } as React.CSSProperties}>
              <span className="instrument__tooltip">Rubick</span>
            </div>
            <div className="instrument__dot instrument__dot--2" style={{ '--x': '65%', '--y': '70%' } as React.CSSProperties}>
              <span className="instrument__tooltip">Pudge</span>
            </div>
            <div className="instrument__dot instrument__dot--3" style={{ '--x': '40%', '--y': '25%' } as React.CSSProperties}>
              <span className="instrument__tooltip">Invoker</span>
            </div>
            
            <span className="instrument__time">MATCHLAB_SYS // 00:00</span>
            <span className="instrument__label">INTELLIGENCE RADAR</span>
            <span className="instrument__coordinate">MATCH DATA // LIVE INDEX</span>

            <div className="instrument__hud-card instrument__hud-card--top-right">
              <span className="hud-metric">NET_SURGE: +2.4K</span>
              <span className="hud-metric-label">SYS_ALERT / MIN_12</span>
            </div>
            <div className="instrument__hud-card instrument__hud-card--bottom-left">
              <span className="hud-metric">DRAFT_EFF: 94.6%</span>
              <span className="hud-metric-label">STABILITY_OK</span>
            </div>
          </div>
        </div>
      </section>

      <section className="workflow" aria-labelledby="workflow-title">
        <div className="workflow__intro">
          <p className="eyebrow">PIPELINE / THREE STEPS</p>
          <h2 id="workflow-title">От match ID до вывода</h2>
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
    </>
  );
}
