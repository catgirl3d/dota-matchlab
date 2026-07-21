import type { PlayerPosition } from './match-detail';

export type PositionIcon = {
  label: string;
  src: string;
};

const positionIconModules = import.meta.glob<string>('../../../assets/icons/pos*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});

const positionIconSources = Object.fromEntries(
  Object.entries(positionIconModules).flatMap(([path, src]) => {
    const match = /pos([1-5])\.webp$/.exec(path);
    return match ? [[Number(match[1]), src]] : [];
  }),
) as Partial<Record<PlayerPosition, string>>;

const POSITION_LABELS: Record<PlayerPosition, string> = {
  1: 'Carry',
  2: 'Mid',
  3: 'Offlane',
  4: 'Soft support',
  5: 'Hard support',
};

export function getPositionIcon(position: PlayerPosition): PositionIcon | null {
  const src = positionIconSources[position];
  return src ? { label: getPositionLabel(position), src } : null;
}

export function getPositionLabel(position: PlayerPosition): string {
  return POSITION_LABELS[position];
}
