import { heroIconSlugs } from './hero-icon-slugs';

export type HeroIcon = {
  label: string;
  src: string;
};

export type HeroPortrait = HeroIcon;

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

const heroPortraitModules = import.meta.glob<string>('../../../assets/heroes/*_horz_gMtz.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});

const heroPortraitUrlsBySlug = Object.fromEntries(
  Object.entries(heroPortraitModules).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'_horz_gMtz.webp'.length),
    url,
  ]),
);

export function getHeroIcon(heroId: number, label: string = formatHeroLabel(heroIconSlugs[heroId] ?? '')): HeroIcon | null {
  const slug = heroIconSlugs[heroId];
  if (!slug) return null;

  const src = heroIconUrlsBySlug[slug];
  return src ? { label, src } : null;
}

export function getHeroPortrait(heroId: number, label: string = formatHeroLabel(heroIconSlugs[heroId] ?? '')): HeroPortrait | null {
  const slug = heroIconSlugs[heroId];
  if (!slug) return null;

  const src = heroPortraitUrlsBySlug[slug];
  return src ? { label, src } : null;
}

function formatHeroLabel(slug: string): string {
  return slug.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
