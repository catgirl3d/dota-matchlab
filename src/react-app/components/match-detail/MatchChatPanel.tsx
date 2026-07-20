import { useState } from 'react';
import type { MatchChatMessage } from '../../lib/match-detail';
import { HeroMark } from '../HeroMark';
import { formatAccount, formatEventTime, heroLabel, heroMark } from './match-detail-display';

type MatchChatPanelProps = {
  messages: MatchChatMessage[];
  heroNames: Record<number, string>;
};

export function MatchChatPanel({ messages, heroNames }: MatchChatPanelProps) {
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
      <MatchChatHeroMark heroId={message.heroId} heroNames={heroNames} />
      <div>
        <strong>{message.playerName ?? formatAccount(message.accountId)}</strong>
        <span>{heroLabel(message.heroId, heroNames)}</span>
        <p>{message.type === 'text' ? message.message : `Chat wheel #${message.chatWheelId}`}</p>
      </div>
    </article>
  );
}

function MatchChatHeroMark({ heroId, heroNames }: { heroId: number | null; heroNames: Record<number, string> }) {
  const label = heroLabel(heroId, heroNames);
  return <HeroMark heroId={heroId} label={label} fallback={heroMark(heroId, heroNames)} className="scoreboard-player__hero" />;
}
