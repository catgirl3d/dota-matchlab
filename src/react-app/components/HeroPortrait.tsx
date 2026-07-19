import { getHeroPortrait } from '../lib/hero-icons';

type HeroPortraitProps = {
  heroId: number | null;
  label: string;
  fallback: string;
  className: string;
};

export function HeroPortrait({ heroId, label, fallback, className }: HeroPortraitProps) {
  const portrait = heroId === null ? null : getHeroPortrait(heroId, label);

  return (
    <span className={className} aria-hidden="true">
      {portrait ? <img className="hero-portrait__image" src={portrait.src} alt="" title={portrait.label} /> : fallback}
    </span>
  );
}
