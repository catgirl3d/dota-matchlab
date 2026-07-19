export type AbilityIcon = {
  src: string;
};

const abilityIconModules = import.meta.glob<string>('../../../assets/abilities/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});

const abilityIconUrlsByName = Object.fromEntries(
  Object.entries(abilityIconModules).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.webp'.length),
    url,
  ]),
);

export function getAbilityIcon(name: string | null): AbilityIcon | null {
  if (!name) return null;

  const src = abilityIconUrlsByName[name];
  return src ? { src } : null;
}
