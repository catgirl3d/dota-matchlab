import { getHeroIcon } from '../lib/hero-icons';

type HeroMarkProps = {
  heroId: number | null;
  label: string;
  fallback: string;
  className: string;
};

export function HeroMark({ heroId, label, fallback, className }: HeroMarkProps) {
  const hero = heroId === null ? null : getHeroIcon(heroId, label);

  return (
    <span className={className} aria-hidden="true">
      {hero ? <img className="hero-mark__image" src={hero.src} alt="" title={hero.label} /> : fallback}
    </span>
  );
}
