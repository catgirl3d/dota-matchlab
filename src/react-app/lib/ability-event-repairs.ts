export type AbilityEventSource = 'player-abilities' | 'playback';

export type AbilityEventRepairContext = {
  source: AbilityEventSource;
  heroId: number | null;
  abilityId: number;
  gameVersionId: number | null;
  isTalent: boolean;
};

export type RepairedAbilityEvent = {
  abilityId: number;
  name: string | null;
};

type KnownAbilityEventRepair = AbilityEventRepairContext & {
  replacement: RepairedAbilityEvent;
};

const knownAbilityEventRepairs: readonly KnownAbilityEventRepair[] = [
  {
    source: 'player-abilities',
    heroId: 40,
    abilityId: 0,
    gameVersionId: 182,
    isTalent: false,
    replacement: { abilityId: 1_749, name: 'venomancer_snakebite' },
  },
];

export function repairAbilityEvent(context: AbilityEventRepairContext): RepairedAbilityEvent {
  const repair = knownAbilityEventRepairs.find((candidate) => (
    candidate.source === context.source &&
    candidate.heroId === context.heroId &&
    candidate.abilityId === context.abilityId &&
    candidate.gameVersionId === context.gameVersionId &&
    candidate.isTalent === context.isTalent
  ));

  return repair ? { ...repair.replacement } : { abilityId: context.abilityId, name: null };
}
