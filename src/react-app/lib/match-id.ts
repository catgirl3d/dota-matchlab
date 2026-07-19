export function parseMatchId(value: string | null | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized || !/^\d+$/.test(normalized)) return null;

  const matchId = Number(normalized);
  return Number.isSafeInteger(matchId) && matchId > 0 ? matchId : null;
}
