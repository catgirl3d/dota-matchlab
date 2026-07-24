import direCrest from '../../../../assets/icons/dire_square.webp?url';
import radiantCrest from '../../../../assets/icons/radiant_square.webp?url';
import { useState } from 'react';
import type { MatchDetailSnapshot } from '../../lib/match-detail';
import { formatGameMode } from '../../lib/game-mode';
import { formatEnum } from './match-detail-display';
import { useTranslation, type TranslationKey } from '../../lib/i18n';

type MatchDetailHeaderProps = {
  detail: MatchDetailSnapshot;
  parseError: Error | null;
  isParsing: boolean;
  parseDisabledReason?: string | null;
  backLabel: string;
  onBack: () => void;
  onRefresh: () => void;
  onParse: () => void;
};

export function MatchDetailHeader({
  detail,
  parseError,
  isParsing,
  parseDisabledReason = null,
  backLabel,
  onBack,
  onRefresh,
  onParse,
}: MatchDetailHeaderProps) {
  const { t, locale } = useTranslation();
  const [highlightedTeam, setHighlightedTeam] = useState<'radiant' | 'dire' | null>(null);
  const hasDetailSections = detail.availableSections.length > 0;
  const detailNotice = detail.detailStatus === 'available'
    ? null
    : hasDetailSections
      ? {
          title: t('headerPartialTitle'),
          message: t('headerPartialDesc'),
        }
      : {
          title: t('headerBaseTitle'),
          message: t('headerBaseDesc'),
        };
  const radiantLabel = detail.radiantWin === true ? 'WON' : detail.radiantWin === false ? 'LOST' : '—';
  const direLabel = detail.radiantWin === false ? 'WON' : detail.radiantWin === true ? 'LOST' : '—';

  return (
    <>
      <div className="match-detail__toolbar">
        <button className="match-detail__back" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          {backLabel}
        </button>
        <div className="match-detail__signals">
          <span>{t('headerSource')} {detail.source.toUpperCase()}</span>
          <span className={`detail-status detail-status--${detail.detailStatus}`}>
            {formatDetailStatus(detail.detailStatus, t)}
          </span>
          <button type="button" onClick={onRefresh}>{t('headerRefresh')}</button>
        </div>
      </div>

      <header className={`match-detail__scoreline${highlightedTeam ? ` is-${highlightedTeam}-focused` : ''}`}>
        <TeamOutcome
          side="radiant"
          label="Radiant"
          outcome={radiantLabel}
          score={detail.radiantScore}
          won={detail.radiantWin === true}
          isFocused={highlightedTeam === 'radiant'}
          isMuted={highlightedTeam === 'dire'}
          onFocusChange={setHighlightedTeam}
        />
        <div className="match-detail__clock">
          <span className="micro-label">MATCH / {detail.matchId}</span>
          <strong>{formatDuration(detail.durationSeconds)}</strong>
          <span>{formatGameMode(detail.gameMode, t)} · {formatDate(detail.startTime, locale)}</span>
        </div>
        <TeamOutcome
          side="dire"
          label="Dire"
          outcome={direLabel}
          score={detail.direScore}
          won={detail.radiantWin === false}
          isFocused={highlightedTeam === 'dire'}
          isMuted={highlightedTeam === 'radiant'}
          onFocusChange={setHighlightedTeam}
        />
      </header>
      <MatchKillStrip radiantScore={detail.radiantScore} direScore={detail.direScore} highlightedTeam={highlightedTeam} onFocusChange={setHighlightedTeam} />

      {detailNotice ? (
        <div className="match-detail__notice">
          <div>
            <strong>{detailNotice.title}</strong>
            <span>{detailNotice.message}</span>
          </div>
          {parseDisabledReason ? (
            <span className="match-detail__parse-restriction">{parseDisabledReason}</span>
          ) : (
            <button type="button" onClick={onParse} disabled={isParsing}>
              {isParsing ? t('headerLoadDetails') : t('headerLoadFullParse')}
            </button>
          )}
          {parseError ? <span className="match-detail__parse-error">{parseError.message}</span> : null}
        </div>
      ) : null}
    </>
  );
}

function MatchKillStrip({
  radiantScore,
  direScore,
  highlightedTeam,
  onFocusChange,
}: {
  radiantScore: number;
  direScore: number;
  highlightedTeam: 'radiant' | 'dire' | null;
  onFocusChange: (team: 'radiant' | 'dire' | null) => void;
}) {
  const { t } = useTranslation();
  const trackColumns = `${Math.max(radiantScore, 1)}fr ${Math.max(direScore, 1)}fr`;

  return (
    <section className={`match-detail__kill-strip${highlightedTeam ? ` is-${highlightedTeam}-focused` : ''}`} aria-label={t('headerTeamKills')}>
      <div className="match-detail__kill-strip-track" style={{ gridTemplateColumns: trackColumns }}>
        <span
          className="match-detail__kill-strip-track-value match-detail__kill-strip-track-value--radiant"
          onPointerEnter={() => onFocusChange('radiant')}
          onPointerLeave={() => onFocusChange(null)}
        />
        <span
          className="match-detail__kill-strip-track-value match-detail__kill-strip-track-value--dire"
          onPointerEnter={() => onFocusChange('dire')}
          onPointerLeave={() => onFocusChange(null)}
        />
      </div>
    </section>
  );
}

function TeamOutcome({
  side,
  label,
  outcome,
  score,
  won,
  isFocused,
  isMuted,
  onFocusChange,
}: {
  side: 'radiant' | 'dire';
  label: string;
  outcome: string;
  score: number;
  won: boolean;
  isFocused: boolean;
  isMuted: boolean;
  onFocusChange: (team: 'radiant' | 'dire' | null) => void;
}) {
  const crestSrc = side === 'radiant' ? radiantCrest : direCrest;

  return (
    <div
      className={`team-outcome team-outcome--${side}${won ? ' is-winner' : ''}${isFocused ? ' is-focused' : ''}${isMuted ? ' is-muted' : ''}`}
      tabIndex={0}
      onPointerEnter={() => onFocusChange(side)}
      onPointerLeave={() => onFocusChange(null)}
      onFocus={() => onFocusChange(side)}
      onBlur={() => onFocusChange(null)}
    >
      <span className="team-outcome__crest" aria-hidden="true">
        <img src={crestSrc} alt="" />
      </span>
      <div>
        <span className="micro-label">{outcome}</span>
        <strong>{label}</strong>
        {won ? <span className="team-outcome__winner-mark">WINNER</span> : null}
      </div>
      <span className="team-outcome__score">{score}</span>
    </div>
  );
}

function formatDetailStatus(status: string, t: (key: TranslationKey) => string): string {
  const mapping: Record<string, TranslationKey> = {
    not_requested: 'headerBaseData',
    pending: 'headerQueue',
    available: 'headerFullParse',
    unavailable: 'headerDetailsUnavailable',
    failed: 'headerFailed',
  };
  const key = mapping[status];
  return key ? t(key) : formatEnum(status);
}

function formatDate(timestamp: number | null, locale: 'en'): string {
  if (timestamp === null) return 'Unknown date';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1_000));
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}
