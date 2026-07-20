import type { MatchDetailSnapshot } from '../lib/match-detail';
import { FocusedPlayerAnalysis } from './match-detail/FocusedPlayerAnalysis';
import { MatchChatPanel } from './match-detail/MatchChatPanel';
import { MatchDraftPanel } from './match-detail/MatchDraftPanel';
import { MatchDetailHeader } from './match-detail/MatchDetailHeader';
import { MatchInsightsPanel } from './match-detail/MatchInsightsPanel';
import { MatchScoreboard } from './match-detail/MatchScoreboard';
import { TeamBuildsPanel } from './match-detail/TeamBuildsPanel';

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
          <FocusedPlayerAnalysis player={focusedPlayer} heroNames={heroNames} durationSeconds={detail.durationSeconds} />
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
