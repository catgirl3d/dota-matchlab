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

export function getPositionIcon(position: PlayerPosition): PositionIcon | null {
  const src = positionIconSources[position];
  return src ? { label: `Position ${position}`, src } : null;
}
