import type { MatchDetailSnapshot } from '../../lib/match-detail';
import { HeroMark } from '../HeroMark';
import { DetailHeading } from './match-detail-primitives';

type MatchDraftPanelProps = {
  pickBans: MatchDetailSnapshot['pickBans'];
  heroNames: Record<number, string>;
};

export function MatchDraftPanel({ pickBans, heroNames }: MatchDraftPanelProps) {
  return (
    <section className="detail-panel detail-draft" aria-labelledby="draft-title">
      <DetailHeading eyebrow="DRAFT / ORDER" title="Picks and bans" id="draft-title" />
      {pickBans.length === 0 ? (
        <p className="detail-empty">Draft data is not available for this match.</p>
      ) : (
        <div className="detail-draft__sequence">
          {pickBans.map((entry, index) => {
            const label = heroNames[entry.heroId] ?? `Hero #${entry.heroId}`;
            const teamClass = entry.isRadiant === true ? 'is-team-radiant' : entry.isRadiant === false ? 'is-team-dire' : '';
            return (
              <article
                className={`detail-draft__entry ${entry.isPick ? 'is-pick' : 'is-ban'} ${teamClass}`}
                key={`${entry.order ?? index}-${entry.heroId}`}
              >
                <span>{entry.order ?? index + 1}</span>
                <HeroMark heroId={entry.heroId} label={label} fallback={label.slice(0, 2).toUpperCase()} className="detail-draft__hero-mark" />
                <strong>{label}</strong>
                <small>{entry.isPick ? 'PICK' : 'BAN'} · {entry.isRadiant === true ? 'R' : entry.isRadiant === false ? 'D' : '?'}</small>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
