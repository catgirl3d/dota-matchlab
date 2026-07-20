export function heroLabel(heroId: number | null, heroNames: Record<number, string>): string {
  return heroId === null ? 'Unknown hero' : heroNames[heroId] ?? `Hero #${heroId}`;
}

export function heroMark(heroId: number | null, heroNames: Record<number, string>): string {
  return heroId === null ? '?' : heroLabel(heroId, heroNames).slice(0, 2).toUpperCase();
}

export function formatAccount(accountId: number | null): string {
  return accountId === null ? 'Anonymous player' : `Player #${accountId}`;
}

export function formatEnum(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function formatEventTime(seconds: number): string {
  const sign = seconds < 0 ? '−' : '';
  const absolute = Math.abs(seconds);
  return `${sign}${Math.floor(absolute / 60)}:${(absolute % 60).toString().padStart(2, '0')}`;
}
