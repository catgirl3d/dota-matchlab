import { getHeroIcon } from '../lib/hero-icons';
import { Tooltip } from './Tooltip';

type HeroMarkProps = {
  heroId: number | null;
  label: string;
  fallback: string;
  className: string;
};

export function HeroMark({ heroId, label, fallback, className }: HeroMarkProps) {
  const hero = heroId === null ? null : getHeroIcon(heroId, label);

  return (
    <Tooltip className={className} content={hero?.label ?? label} focusable={false}>
      <span aria-hidden="true">
        {hero ? <img className="hero-mark__image" src={hero.src} alt="" /> : fallback}
      </span>
    </Tooltip>
  );
}
