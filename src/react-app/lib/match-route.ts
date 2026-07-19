export type MatchRoute = { kind: 'archive' } | { kind: 'match'; matchId: number } | { kind: 'invalid-match' };

export function parseMatchRoute(pathname: string): MatchRoute {
  if (!pathname.startsWith('/matches/')) return { kind: 'archive' };
  const match = /^\/matches\/(\d+)$/.exec(pathname);
  if (!match) return { kind: 'invalid-match' };
  const matchId = Number(match[1]);
  return Number.isSafeInteger(matchId) && matchId > 0 ? { kind: 'match', matchId } : { kind: 'invalid-match' };
}

export function matchPath(matchId: number): string {
  if (!Number.isSafeInteger(matchId) || matchId <= 0) throw new Error('Invalid match ID');
  return `/matches/${matchId}`;
}
