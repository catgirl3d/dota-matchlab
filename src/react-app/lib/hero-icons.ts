import { heroIconSlugs } from './hero-icon-slugs';

export type HeroIcon = {
  label: string;
  src: string;
};

const heroIconModules = import.meta.glob<string>('../../../assets/hero_icons/*_icon_5fO3.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});

const heroIconUrlsBySlug = Object.fromEntries(
  Object.entries(heroIconModules).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'_icon_5fO3.webp'.length),
    url,
  ]),
);

export function getHeroIcon(heroId: number, label: string = formatHeroLabel(heroIconSlugs[heroId] ?? '')): HeroIcon | null {
  const slug = heroIconSlugs[heroId];
  if (!slug) return null;

  const src = heroIconUrlsBySlug[slug];
  return src ? { label, src } : null;
}

function formatHeroLabel(slug: string): string {
  return slug.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
