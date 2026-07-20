import { Show, SignInButton, UserButton } from '@clerk/react';
import { BrowserRouter, Link, Route, Routes, useSearchParams } from 'react-router';
import { ArchiveShowcaseAlias } from './components/ArchiveShowcaseAlias';
import { ArchiveShowcase } from './components/ArchiveShowcase';
import { LandingPage } from './components/LandingPage';
import { MatchDetailRoute, MatchRouteLayout, RouteError } from './components/MatchRoute';
import { MatchWorkspace } from './components/MatchWorkspace';
import { parseMatchId } from './lib/match-id';
import { useTranslation } from './lib/i18n';


type AppProps = {
  clerkEnabled: boolean;
};

export default function App({ clerkEnabled }: AppProps) {
  const { t } = useTranslation();
  return <BrowserRouter><div className="app-shell">
      <header className="topbar">
        <Link className="wordmark" to="/" aria-label={t('homeAriaLabel')}>
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
          <Route path="/demo" element={<ArchiveShowcaseAlias slug="demo" />} />
          <Route path="/archive" element={<ArchiveRoute clerkEnabled={clerkEnabled} />} />
          <Route path="/matches/:matchId" element={<MatchRouteLayout authEnabled={clerkEnabled} />}>
            <Route index element={<MatchDetailRoute />} />
          </Route>
          <Route path="*" element={<RouteError text={t('pageNotFound')} />} />
        </Routes>
      </main>

      <footer className="footer">
        <span>INDEPENDENT ANALYSIS TOOL</span>
        <span>DATA PROVIDER: STRATZ PRIMARY · OPENDOTA FALLBACK</span>
      </footer>
    </div></BrowserRouter>;
}

function HeaderActions({ clerkEnabled }: AppProps) {
  const { t } = useTranslation();
  return (
    <div className="topbar__actions">
      <div className="release-tag">
        <span className="release-tag__pulse" aria-hidden="true" />
        PUBLIC BETA · 0.2
      </div>
      {clerkEnabled ? (
        <>
          <Show when="signed-out">
            <Link className="topbar__archive-link" to="/demo">{t('demo')}</Link>
            <SignInButton mode="modal">
              <button className="topbar__auth-button" type="button">{t('signInBtn')}</button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link className="topbar__archive-link" to="/archive">{t('myArchive')}</Link>
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
  const [searchParams] = useSearchParams();
  const playerId = parseMatchId(searchParams.get('player'));
  const gate = <ArchiveGate clerkEnabled={clerkEnabled} />;
  const { t } = useTranslation();

  if (playerId !== null) {
    return clerkEnabled ? (
      <>
        <Show when="signed-in"><MatchWorkspace /></Show>
        <Show when="signed-out"><ArchiveShowcase key={playerId} dotaAccountId={playerId} fallback={gate} /></Show>
      </>
    ) : <ArchiveShowcase key={playerId} dotaAccountId={playerId} fallback={gate} />;
  }
  if (!clerkEnabled) {
    return <RouteError text={t('authNotConfigured')} />;
  }

  return (
    <>
      <Show when="signed-in"><MatchWorkspace /></Show>
      <Show when="signed-out">{gate}</Show>
    </>
  );
}

export function ArchiveGate({ clerkEnabled }: AppProps) {
  const { t } = useTranslation();
  if (!clerkEnabled) return <RouteError text={t('authNotConfigured')} />;
  return <section className="archive-gate" aria-labelledby="archive-gate-title">
    <p className="eyebrow">PRIVATE ARCHIVE / AUTH REQUIRED</p>
    <h1 id="archive-gate-title">{t('authRequired')}</h1>
    <p>{t('authRequiredDesc')}</p>
    <SignInButton mode="modal"><button className="archive-gate__button" type="button">{t('signInToArchive')}</button></SignInButton>
  </section>;
}
