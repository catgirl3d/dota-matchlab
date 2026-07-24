import { useState } from 'react';
import type { MatchDetailSnapshot } from '../lib/match-detail';
import { FocusedPlayerAnalysis } from './match-detail/FocusedPlayerAnalysis';
import { MatchChatPanel } from './match-detail/MatchChatPanel';
import { MatchDraftPanel } from './match-detail/MatchDraftPanel';
import { MatchDetailHeader } from './match-detail/MatchDetailHeader';
import { MatchScoreboard } from './match-detail/MatchScoreboard';
import { TeamBuildsPanel } from './match-detail/TeamBuildsPanel';
import { useTranslation } from '../lib/i18n';
import { AdvantagePanel } from './match-detail/AdvantagePanel';
import { KillHistoryPanel } from './match-detail/KillHistoryPanel';
import { KillBreakdownPanel } from './match-detail/KillBreakdownPanel';
import { LaneAnalysisPanel } from './match-detail/LaneAnalysisPanel';
import { PlayerContributionPanel } from './match-detail/PlayerContributionPanel';
import { RoleBreakdownPanel } from './match-detail/RoleBreakdownPanel';


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

type MatchPlayerSelection = {
  matchId: number;
  playerKey: string;
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
  backLabel,
  onBack,
  onRefresh,
  onParse,
}: MatchDetailViewProps) {
  const { t } = useTranslation();
  const [playerSelection, setPlayerSelection] = useState<MatchPlayerSelection | null>(null);
  const effectiveBackLabel = backLabel ?? t('backToArchive');

  if (isLoading) {
    return <DetailMessage text={t('loadingMatch')} backLabel={effectiveBackLabel} onBack={onBack} />;
  }
  if (error) {
    return <DetailMessage text={error.message} tone="error" backLabel={effectiveBackLabel} onBack={onBack} />;
  }
  if (!detail) {
    return <DetailMessage text={t('matchNotFound')} backLabel={effectiveBackLabel} onBack={onBack} />;
  }

  const radiantPlayers = detail.players.filter((player) => player.isRadiant);
  const direPlayers = detail.players.filter((player) => !player.isRadiant);

  const focusedPlayer = currentAccountId === null
    ? null
    : detail.players.find((player) => player.accountId === currentAccountId) ?? null;
  const selectedPlayer = playerSelection?.matchId === detail.matchId
    ? detail.players.find((player) => player.key === playerSelection.playerKey) ?? null
    : null;
  const selectedPlayerKey = selectedPlayer?.key ?? null;
  const analysisPlayer = selectedPlayer ?? focusedPlayer;
  const contributionPlayer = selectedPlayer ?? focusedPlayer ?? detail.players[0] ?? null;
  const selectPlayer = (playerKey: string | null) => {
    setPlayerSelection(playerKey === null ? null : { matchId: detail.matchId, playerKey });
  };
  const hasPlayerStats = detail.availableSections.includes('player_stats');
  return (
    <section className="match-detail" aria-label="Match detail">
      <MatchDetailHeader
        detail={detail}
        parseError={parseError}
        isParsing={isParsing}
        parseDisabledReason={parseDisabledReason}
        backLabel={effectiveBackLabel}
        onBack={onBack}
        onRefresh={onRefresh}
        onParse={onParse}
      />

      <MatchScoreboard
        radiantPlayers={radiantPlayers}
        direPlayers={direPlayers}
        heroNames={heroNames}
        currentAccountId={currentAccountId}
        selectedPlayerKey={selectedPlayerKey}
        onPlayerSelect={selectPlayer}
      />

      {contributionPlayer ? (
        <PlayerContributionPanel
          player={contributionPlayer}
          players={detail.players}
          heroNames={heroNames}
          hasDetailedEvents={hasPlayerStats}
          events={detail.timelineEvents}
          durationSeconds={detail.durationSeconds}
          onPlayerSelect={selectPlayer}
        />
      ) : null}

      {hasPlayerStats && analysisPlayer ? (
          <FocusedPlayerAnalysis player={analysisPlayer} heroNames={heroNames} durationSeconds={detail.durationSeconds} />
      ) : null}

      <div className="detail-panel-grid detail-panel-grid--timeline">
        <AdvantagePanel
          networth={detail.radiantNetworthLeads}
          experience={detail.radiantExperienceLeads}
          durationSeconds={detail.durationSeconds}
          events={detail.timelineEvents}
        />
        <KillHistoryPanel
          events={detail.timelineEvents}
          players={detail.players}
          heroNames={heroNames}
          isAvailable={hasPlayerStats}
          selectedPlayerKey={selectedPlayerKey}
          onPlayerSelect={selectPlayer}
        />
      </div>

      <LaneAnalysisPanel
        players={detail.players}
        heroNames={heroNames}
        laneOutcomes={detail.laneOutcomes}
        eventCounts={detail.eventCounts}
        selectedPlayerKey={selectedPlayerKey}
      />

      <RoleBreakdownPanel
        players={detail.players}
        heroNames={heroNames}
        selectedPlayerKey={selectedPlayerKey}
      />

      <KillBreakdownPanel
        players={detail.players}
        events={detail.timelineEvents}
        heroNames={heroNames}
        isAvailable={hasPlayerStats}
        selectedPlayerKey={selectedPlayerKey}
        onPlayerSelect={selectPlayer}
      />

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
