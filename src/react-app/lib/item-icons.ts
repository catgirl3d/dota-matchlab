import { itemIconSlugs } from './item-icon-slugs';

type ItemIcon = {
  label: string;
  src: string;
};

const itemIconModules = import.meta.glob<string>('../../../assets/items/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
});

const itemIconUrlsBySlug = Object.fromEntries(
  Object.entries(itemIconModules).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.webp'.length),
    url,
  ]),
);

export function getItemIcon(itemId: number): ItemIcon | null {
  const slug = itemIconSlugs[itemId];
  if (!slug) return null;

  const isRecipe = slug.startsWith('recipe_');
  const targetSlug = isRecipe ? 'recipe' : slug;

  const src = itemIconUrlsBySlug[targetSlug];
  return src ? { label: formatItemLabel(slug), src } : null;
}

function formatItemLabel(slug: string): string {
  if (slug.startsWith('recipe_')) {
    const baseName = slug.slice('recipe_'.length);
    return `${formatRawLabel(baseName)} Recipe`;
  }
  if (slug === 'recipe') {
    return 'Recipe';
  }
  return formatRawLabel(slug);
}

function formatRawLabel(slug: string): string {
  return slug.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
