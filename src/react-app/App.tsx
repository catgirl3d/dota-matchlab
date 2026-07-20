import { Show, SignInButton, UserButton } from '@clerk/react';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { LandingPage } from './components/LandingPage';
import { MatchDetailRoute, MatchRouteLayout, RouteError } from './components/MatchRoute';
import { MatchWorkspace } from './components/MatchWorkspace';

type AppProps = {
  clerkEnabled: boolean;
};

export default function App({ clerkEnabled }: AppProps) {
  return <BrowserRouter><div className="app-shell">
      <header className="topbar">
        <Link className="wordmark" to="/" aria-label="Dota MatchLab, главная">
          <span className="wordmark__mark" aria-hidden="true">
            M/L
          </span>
          <span>DOTA MATCHLAB</span>
        </Link>
        <HeaderActions clerkEnabled={clerkEnabled} />
      </header>

      <main>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/archive" element={<ArchiveRoute clerkEnabled={clerkEnabled} />} />
          <Route path="/matches/:matchId" element={<MatchRouteLayout authEnabled={clerkEnabled} />}>
            <Route index element={<MatchDetailRoute />} />
          </Route>
          <Route path="*" element={<RouteError text="Страница не найдена." />} />
        </Routes>
      </main>

      <footer className="footer">
        <span>INDEPENDENT ANALYSIS TOOL</span>
        <span>DATA PROVIDER: STRATZ PRIMARY · OPENDOTA FALLBACK</span>
      </footer>
    </div></BrowserRouter>;
}

function HeaderActions({ clerkEnabled }: AppProps) {
  return (
    <div className="topbar__actions">
      <div className="release-tag">
        <span className="release-tag__pulse" aria-hidden="true" />
        PUBLIC BETA · 0.2
      </div>
      {clerkEnabled ? (
        <>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="topbar__auth-button" type="button">Войти</button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link className="topbar__archive-link" to="/archive">Мой архив</Link>
            <UserButton />
          </Show>
        </>
      ) : (
        <span className="topbar__config-state">AUTH OFF</span>
      )}
    </div>
  );
}

function ArchiveRoute({ clerkEnabled }: AppProps) {
  if (!clerkEnabled) {
    return <RouteError text="Вход не настроен для этого окружения." />;
  }

  return (
    <>
      <Show when="signed-in"><MatchWorkspace /></Show>
      <Show when="signed-out">
        <section className="archive-gate" aria-labelledby="archive-gate-title">
          <p className="eyebrow">PRIVATE ARCHIVE / AUTH REQUIRED</p>
          <h1 id="archive-gate-title">Требуется авторизация</h1>
          <p>Войдите в аккаунт, чтобы разблокировать импорт новых матчей по ID и отслеживать свою статистику. Просмотр ранее загруженных разборов доступен без входа на главной.</p>
          <SignInButton mode="modal">
            <button className="archive-gate__button" type="button">Войти в архив</button>
          </SignInButton>
        </section>
      </Show>
    </>
  );
}
