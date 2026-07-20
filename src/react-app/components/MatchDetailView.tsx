import { useState } from 'react';
import type {
  MatchChatMessage,
  MatchDetailPlayer,
  MatchDetailSnapshot,
} from '../lib/match-detail';
import { HeroMark } from './HeroMark';
import { PlayerMinuteCharts } from './PlayerMinuteCharts';
import { MatchDraftPanel } from './match-detail/MatchDraftPanel';
import { MatchDetailHeader } from './match-detail/MatchDetailHeader';
import { MatchInsightsPanel } from './match-detail/MatchInsightsPanel';
import { MatchScoreboard } from './match-detail/MatchScoreboard';
import { TeamBuildsPanel } from './match-detail/TeamBuildsPanel';
import { formatAccount, formatCompact, formatEnum, formatEventTime, heroLabel, heroMark } from './match-detail/match-detail-display';
import { DetailHeading } from './match-detail/match-detail-primitives';

type MatchDetailViewProps = {
  detail?: MatchDetailSnapshot;
  heroNames: Record<number, string>;
  currentAccountId: number | null;
  isLoading: boolean;
  error: Error | null;
  parseError: Error | null;
  isParsing: boolean;
  parseDisabledReason?: string | null;
  backLabel?: string;
  onBack: () => void;
  onRefresh: () => void;
  onParse: () => void;
};

export function MatchDetailView({
  detail,
  heroNames,
  currentAccountId,
  isLoading,
  error,
  parseError,
  isParsing,
  parseDisabledReason = null,
  backLabel = 'Назад к архиву',
  onBack,
  onRefresh,
  onParse,
}: MatchDetailViewProps) {
  if (isLoading) {
    return <DetailMessage text="Собираем разбор матча…" backLabel={backLabel} onBack={onBack} />;
  }
  if (error) {
    return <DetailMessage text={error.message} tone="error" backLabel={backLabel} onBack={onBack} />;
  }
  if (!detail) {
    return <DetailMessage text="Матч не найден." backLabel={backLabel} onBack={onBack} />;
  }

  const radiantPlayers = detail.players.filter((player) => player.isRadiant);
  const direPlayers = detail.players.filter((player) => !player.isRadiant);

  const focusedPlayer = currentAccountId === null
    ? null
    : detail.players.find((player) => player.accountId === currentAccountId) ?? null;
  const hasPlayerStats = detail.availableSections.includes('player_stats');
  return (
    <section className="match-detail" aria-label="Match detail">
      <MatchDetailHeader
        detail={detail}
        parseError={parseError}
        isParsing={isParsing}
        parseDisabledReason={parseDisabledReason}
        backLabel={backLabel}
        onBack={onBack}
        onRefresh={onRefresh}
        onParse={onParse}
      />

      <MatchScoreboard
        radiantPlayers={radiantPlayers}
        direPlayers={direPlayers}
        heroNames={heroNames}
        currentAccountId={currentAccountId}
      />

      <MatchInsightsPanel
        networth={detail.radiantNetworthLeads}
        experience={detail.radiantExperienceLeads}
        durationSeconds={detail.durationSeconds}
        events={detail.timelineEvents}
        laneOutcomes={detail.laneOutcomes}
        eventCounts={detail.eventCounts}
      />

      {hasPlayerStats && focusedPlayer ? (
          <FullPlayerAnalysis player={focusedPlayer} heroNames={heroNames} durationSeconds={detail.durationSeconds} />
      ) : null}

      {detail.chatMessages.length > 0 ? (
        <MatchChatPanel messages={detail.chatMessages} heroNames={heroNames} />
      ) : null}

      <MatchDraftPanel pickBans={detail.pickBans} heroNames={heroNames} />

      <TeamBuildsPanel
        players={detail.players}
        heroNames={heroNames}
        currentAccountId={currentAccountId}
        rosterStatus={detail.rosterStatus}
      />
    </section>
  );
}

function MatchChatPanel({
  messages,
  heroNames,
}: {
  messages: MatchChatMessage[];
  heroNames: Record<number, string>;
}) {
  const textCount = messages.filter((message) => message.type === 'text').length;
  const wheelCount = messages.length - textCount;
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'text' | 'all'>(textCount > 0 ? 'text' : 'all');
  const visibleMessages = filter === 'all'
    ? messages
    : messages.filter((message) => message.type === 'text');

  return (
    <section className={`detail-panel match-chat${isOpen ? ' is-open' : ''}`} aria-labelledby="match-chat-title">
      <div className="match-chat__header">
        <div>
          <span className="micro-label">COMMS / OPTIONAL TRANSCRIPT</span>
          <h3 id="match-chat-title">Match chat</h3>
          <p>{textCount} messages · {wheelCount} chat-wheel events</p>
        </div>
        <button type="button" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen}>
          {isOpen ? 'Скрыть чат' : 'Показать чат'}
        </button>
      </div>
      {isOpen ? (
        <div className="match-chat__body">
          <div className="match-chat__controls">
            <span>Необработанный игровой чат может содержать оскорбления.</span>
            <div>
              <button
                className={filter === 'text' ? 'is-active' : ''}
                type="button"
                onClick={() => setFilter('text')}
                disabled={textCount === 0}
              >
                Только текст
              </button>
              <button
                className={filter === 'all' ? 'is-active' : ''}
                type="button"
                onClick={() => setFilter('all')}
              >
                Всё
              </button>
            </div>
          </div>
          <div className="match-chat__transcript" role="log" aria-label="Чат матча">
            {visibleMessages.map((message) => (
              <ChatMessage key={message.key} message={message} heroNames={heroNames} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ChatMessage({
  message,
  heroNames,
}: {
  message: MatchChatMessage;
  heroNames: Record<number, string>;
}) {
  return (
    <article className={`chat-message ${message.isRadiant === true ? 'is-radiant' : message.isRadiant === false ? 'is-dire' : ''}`}>
      <time>{formatEventTime(message.time)}</time>
      <MatchDetailHeroMark heroId={message.heroId} heroNames={heroNames} />
      <div>
        <strong>{message.playerName ?? formatAccount(message.accountId)}</strong>
        <span>{heroLabel(message.heroId, heroNames)}</span>
        <p>{message.type === 'text' ? message.message : `Chat wheel #${message.chatWheelId}`}</p>
      </div>
    </article>
  );
}

function FullPlayerAnalysis({
  player,
  heroNames,
  durationSeconds,
}: {
  player: MatchDetailPlayer;
  heroNames: Record<number, string>;
  durationSeconds: number | null;
}) {
  return (
    <section className="detail-panel full-analysis" aria-labelledby="full-analysis-title">
      <DetailHeading
        eyebrow="FULL DETAIL / PLAYER FOCUS"
        title={`${heroLabel(player.heroId, heroNames)} performance tape`}
        id="full-analysis-title"
      />
      <div className="full-analysis__summary">
        <AnalysisMetric label="Impact" value={player.imp === null ? '—' : `${player.imp > 0 ? '+' : ''}${player.imp}`} />
        <AnalysisMetric label="Award" value={formatEnum(player.award ?? 'NONE')} />
        <AnalysisMetric label="Dota Plus" value={player.dotaPlusLevel === null ? '—' : `Level ${player.dotaPlusLevel}`} />
        <AnalysisMetric label="Actions" value={player.totalActions === null ? '—' : formatCompact(player.totalActions)} />
      </div>
      <div className="full-analysis__body">
        <div className="full-analysis__timelines">
          <span className="micro-label">PER-MINUTE CURVES</span>
          <PlayerMinuteCharts durationSeconds={durationSeconds} series={player.minuteSeries} />
        </div>
        <div className="full-analysis__events">
          <span className="micro-label">PLAYER EVENTS / SELECTED PLAYER</span>
          <div className="event-ledger">
            {Object.entries(player.detailEvents).map(([label, count]) => (
              <span key={label}><strong>{count}</strong>{formatEnum(label)}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MatchDetailHeroMark({ heroId, heroNames }: { heroId: number | null; heroNames: Record<number, string> }) {
  const label = heroLabel(heroId, heroNames);
  return <HeroMark heroId={heroId} label={label} fallback={heroMark(heroId, heroNames)} className="scoreboard-player__hero" />;
}

function AnalysisMetric({ label, value }: { label: string; value: string }) {
  return (
    <article>
      <span className="micro-label">{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function DetailMessage({
  text,
  tone = 'neutral',
  backLabel,
  onBack,
}: {
  text: string;
  tone?: 'neutral' | 'error';
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className={`detail-message detail-message--${tone}`}>
      <button type="button" onClick={onBack}>← {backLabel}</button>
      <p>{text}</p>
    </div>
  );
}
