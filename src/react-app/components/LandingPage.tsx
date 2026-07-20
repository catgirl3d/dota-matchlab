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
        <div className="hero__copy">
          <p className="eyebrow">MATCH INTELLIGENCE / PUBLIC ACCESS</p>
          <h1 id="hero-title">
            Разберите матч
            <span>до последнего тайминга.</span>
          </h1>
          <p className="hero__lede">
            Scoreboard, темп, сборки и события матча в одном техническом отчёте.
            Уже загруженные матчи доступны без регистрации.
          </p>

          <form className="match-search" onSubmit={handleSubmit} noValidate>
            <label htmlFor="match-id">Открыть матч по ID</label>
            <div className="match-search__controls">
              <span className="match-search__prefix" aria-hidden="true">MATCH /</span>
              <input
                id="match-id"
                name="matchId"
                inputMode="numeric"
                autoComplete="off"
                placeholder="8749050591"
                value={matchIdInput}
                aria-invalid={error ? true : undefined}
                aria-describedby="match-search-hint"
                onChange={(event) => {
                  setMatchIdInput(event.target.value);
                  if (error) setError(null);
                }}
              />
              <button type="submit">Открыть разбор</button>
            </div>
            <p id="match-search-hint" className={error ? 'match-search__hint match-search__hint--error' : 'match-search__hint'}>
              {error ?? 'Новый матч можно загрузить после входа.'}
            </p>
            <div className="match-search__example">
              Пример:{' '}
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
          </form>
        </div>

        <div className="hero__instrument" aria-hidden="true">
          <div className="instrument__axis instrument__axis--vertical" />
          <div className="instrument__axis instrument__axis--horizontal" />
          <span className="instrument__time">00:00</span>
          <span className="instrument__label">ANALYSIS WINDOW</span>
          <span className="instrument__coordinate">MATCH DATA / LIVE INDEX</span>
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
