import { describe, expect, it } from 'vitest';
import { repairAbilityEvent } from './ability-event-repairs';

describe('repairAbilityEvent', () => {
  it('repairs the known STRATZ Snakebite placeholder', () => {
    expect(repairAbilityEvent({
      source: 'player-abilities',
      heroId: 40,
      abilityId: 0,
      gameVersionId: 182,
      isTalent: false,
    })).toEqual({ abilityId: 1_749, name: 'venomancer_snakebite' });
  });

  it.each([
    { source: 'player-abilities' as const, heroId: 41, abilityId: 0, gameVersionId: 182, isTalent: false },
    { source: 'player-abilities' as const, heroId: 40, abilityId: 0, gameVersionId: 181, isTalent: false },
    { source: 'playback' as const, heroId: 40, abilityId: 0, gameVersionId: 182, isTalent: false },
    { source: 'player-abilities' as const, heroId: 40, abilityId: 1_749, gameVersionId: 182, isTalent: false },
    { source: 'player-abilities' as const, heroId: 40, abilityId: 0, gameVersionId: 182, isTalent: true },
  ])('leaves non-matching events unchanged', (context) => {
    expect(repairAbilityEvent(context)).toEqual({ abilityId: context.abilityId, name: null });
  });
});
