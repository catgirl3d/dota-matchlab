import { getHeroPortrait } from '../lib/hero-icons';
import { Tooltip } from './Tooltip';

type HeroPortraitProps = {
  heroId: number | null;
  label: string;
  fallback: string;
  className: string;
};

export function HeroPortrait({ heroId, label, fallback, className }: HeroPortraitProps) {
  const portrait = heroId === null ? null : getHeroPortrait(heroId, label);

  return (
    <Tooltip className={className} content={portrait?.label ?? label} focusable={false}>
      <span aria-hidden="true">
        {portrait ? <img className="hero-portrait__image" src={portrait.src} alt="" /> : fallback}
      </span>
    </Tooltip>
  );
}
