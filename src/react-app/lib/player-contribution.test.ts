import { describe, expect, it } from 'vitest';
import type { MatchDetailPlayer, MatchTimelineEvent } from './match-detail';
import { calculatePlayerContribution, calculatePlayerResponsibility, calculateTeamOutputShare } from './player-contribution';

describe('calculatePlayerContribution', () => {
  it('scores a stronger same-position player above parity without reading IMP', () => {
    const players = [
      player({ key: 'selected', accountId: 1, position: 2, kills: 10, assists: 12, deaths: 2, heroDamage: 30_000, towerDamage: 4_000, netWorth: 20_000, goldPerMinute: 650, xpPerMinute: 720, imp: -99 }),
      player({ key: 'ally', accountId: 2, position: 1, kills: 5, assists: 5, deaths: 5 }),
      player({ key: 'opponent', accountId: 3, position: 2, isRadiant: false, kills: 4, assists: 6, deaths: 7, heroDamage: 15_000, towerDamage: 1_000, netWorth: 15_000, goldPerMinute: 500, xpPerMinute: 540, imp: 99 }),
      player({ key: 'enemy', accountId: 4, position: 1, isRadiant: false, kills: 6, assists: 4, deaths: 8 }),
    ];

    const result = calculatePlayerContribution(players, 'selected', { hasDetailedEvents: true });
    const changedImp = calculatePlayerContribution(players.map((entry) => ({ ...entry, imp: entry.imp === null ? null : entry.imp * -10 })), 'selected', { hasDetailedEvents: true });
    const responsibility = calculatePlayerResponsibility(players, 'selected', [], 2_400, { hasDetailedEvents: true });
    const changedImpResponsibility = calculatePlayerResponsibility(players.map((entry) => ({ ...entry, imp: entry.imp === null ? null : entry.imp * -10 })), 'selected', [], 2_400, { hasDetailedEvents: true });

    expect(result?.score).toBeGreaterThan(50);
    expect(result?.benchmark).toEqual({ kind: 'position-opponent', playerKey: 'opponent' });
    expect(result?.confidence).toBe('high');
    expect(changedImp).toEqual(result);
    expect(changedImpResponsibility).toEqual(responsibility);
  });

  it('uses support weights and renormalizes unavailable lane data', () => {
    const players = [
      player({ key: 'selected', accountId: 1, position: 5, minuteSeries: emptySeries(), detailEvents: { kills: 0, deaths: 0, assists: 0, wards: 8, runes: 4, itemUses: 0, wardDestructions: 3 } }),
      player({ key: 'opponent', accountId: 2, position: 5, isRadiant: false, minuteSeries: emptySeries(), detailEvents: { kills: 0, deaths: 0, assists: 0, wards: 2, runes: 1, itemUses: 0, wardDestructions: 0 } }),
    ];

    const result = calculatePlayerContribution(players, 'selected', { hasDetailedEvents: true });
    const utility = result?.dimensions.find((dimension) => dimension.id === 'utility');

    expect(result?.role).toBe('support');
    expect(result?.dimensions.some((dimension) => dimension.id === 'lane')).toBe(false);
    expect(result?.dimensions.reduce((total, dimension) => total + dimension.weight, 0)).toBe(100);
    expect(utility?.weight).toBeGreaterThan(30);
  });

  it('falls back to the opposing team average when position data is missing', () => {
    const result = calculatePlayerContribution([
      player({ key: 'selected', accountId: 1, position: null, minuteSeries: emptySeries() }),
      player({ key: 'enemy-1', accountId: 2, position: 1, isRadiant: false, minuteSeries: emptySeries() }),
      player({ key: 'enemy-2', accountId: 3, position: 5, isRadiant: false, minuteSeries: emptySeries() }),
    ], 'selected', { hasDetailedEvents: false });

    expect(result?.benchmark).toEqual({ kind: 'opposing-team-average', playerKey: null });
    expect(result?.confidence).toBe('low');
  });

  it('returns exact parity for statistically equal position opponents', () => {
    const result = calculatePlayerContribution([
      player({ key: 'selected', accountId: 1, position: 3 }),
      player({ key: 'opponent', accountId: 2, position: 3, isRadiant: false }),
    ], 'selected', { hasDetailedEvents: true });

    expect(result?.score).toBe(50);
    expect(result?.dimensions.every((dimension) => dimension.score === 50)).toBe(true);
    expect(result?.dimensions.reduce((total, dimension) => total + dimension.weight, 0)).toBe(100);
  });

  it('exposes repeated untraded late deaths and objective exposure as liability', () => {
    const players = [
      player({ key: 'selected', accountId: 1, position: 2, deaths: 2 }),
      player({ key: 'opponent', accountId: 2, position: 2, isRadiant: false, deaths: 0 }),
    ];
    const events: MatchTimelineEvent[] = [
      kill('death-1', 220, 2, 1),
      { key: 'tower-1', time: 230, type: 'tower', actor: { accountId: 2, heroId: 1, name: 'Opponent', isRadiant: false }, target: null, isRadiant: false, targetIsRadiant: true },
      kill('death-2', 280, 2, 1),
      { key: 'tower-at-window-end', time: 300, type: 'tower', actor: { accountId: 2, heroId: 1, name: 'Opponent', isRadiant: false }, target: null, isRadiant: false, targetIsRadiant: true },
      { key: 'tower-outside-window', time: 301, type: 'tower', actor: { accountId: 2, heroId: 1, name: 'Opponent', isRadiant: false }, target: null, isRadiant: false, targetIsRadiant: true },
    ];

    const result = calculatePlayerResponsibility(players, 'selected', events, 300, { hasDetailedEvents: true });
    const noExposureResult = calculatePlayerResponsibility(players, 'opponent', events, 300, { hasDetailedEvents: true });
    const deathCost = result?.liability.dimensions.find((dimension) => dimension.id === 'death-cost');
    const objectiveExposure = result?.liability.dimensions.find((dimension) => dimension.id === 'objective-exposure');
    const noObjectiveExposure = noExposureResult?.liability.dimensions.find((dimension) => dimension.id === 'objective-exposure');

    expect(deathCost?.score).toBeGreaterThan(50);
    expect(objectiveExposure?.score).toBe(50);
    expect(noObjectiveExposure?.score).toBe(0);
    expect(result?.metrics).toMatchObject({
      deaths: 2,
      untradedDeaths: 2,
      chainDeaths: 1,
      lateDeaths: 2,
      objectiveExposureDeaths: 1,
      objectiveExposureWeight: 0.5,
    });
  });

  it('keeps zero tower damage at zero in match 8749050591', () => {
    const result = calculatePlayerContribution(realMatch8749050591Players(), 'storm-spirit', { hasDetailedEvents: true });
    const dimensions = Object.fromEntries(result?.dimensions.map((dimension) => [dimension.id, dimension.score]) ?? []);

    expect(dimensions).toEqual({
      fight: 46,
      lane: 36,
      economy: 43,
      objectives: 0,
      utility: 45,
    });
    expect(result?.score).toBe(36);
    expect(result?.benchmark).toEqual({ kind: 'position-opponent', playerKey: 'shadow-fiend' });
  });

  it.each([
    { resourceShare: 20, outputShare: 25, expectedScore: 0 },
    { resourceShare: 23, outputShare: 20, expectedScore: 0 },
    { resourceShare: 29, outputShare: 20, expectedScore: 50 },
    { resourceShare: 35, outputShare: 20, expectedScore: 100 },
    { resourceShare: 40, outputShare: 20, expectedScore: 100 },
  ])('maps a $resourceShare% resource / $outputShare% output gap to $expectedScore', ({ resourceShare, outputShare, expectedScore }) => {
    const result = calculatePlayerResponsibility(resourceConversionPlayers(resourceShare, outputShare), 'selected', [], 2_400, { hasDetailedEvents: false });
    const resourceConversion = result?.liability.dimensions.find((dimension) => dimension.id === 'resource-conversion-gap');

    expect(resourceConversion?.score).toBe(expectedScore);
  });

  it('rates the Necrophos conversion gap in match 8749050591 independently of Windranger', () => {
    const players = realMatch8749050591Players();
    const result = calculatePlayerResponsibility(players, 'necrophos', [], 3_600, { hasDetailedEvents: false });
    const changedOpponent = calculatePlayerResponsibility(players.map((entry) => entry.key === 'windranger'
      ? { ...entry, netWorth: 100_000, heroDamage: 0, towerDamage: 0, assists: 0, heroHealing: 0 }
      : entry), 'necrophos', [], 3_600, { hasDetailedEvents: false });
    const resourceConversion = result?.liability.dimensions.find((dimension) => dimension.id === 'resource-conversion-gap');
    const changedOpponentResourceConversion = changedOpponent?.liability.dimensions.find((dimension) => dimension.id === 'resource-conversion-gap');

    expect(resourceConversion?.score).toBe(8);
    expect(changedOpponentResourceConversion?.score).toBe(8);
    expect(result?.metrics).toMatchObject({
      resourceShare: 27,
      outputShare: 23,
      resourceConversionGap: 4,
    });
  });
});

describe('calculateTeamOutputShare', () => {
  it('allocates exactly 100% of measured output across the five teammates', () => {
    const players = realMatch8749050591Players();
    const direPlayers = players.filter((entry) => !entry.isRadiant);
    const results = direPlayers.map((entry) => calculateTeamOutputShare(players, entry.key));
    const witchDoctor = results[direPlayers.findIndex((entry) => entry.key === 'witch-doctor')];

    expect(results.every((result) => result !== null)).toBe(true);
    expect(results.reduce((total, result) => total + (result?.score ?? 0), 0)).toBe(100);
    expect(witchDoctor?.score).toBe(15);
    expect(witchDoctor?.equalShare).toBe(20);
    expect(witchDoctor?.components.map(({ id, score, weight }) => ({ id, score, weight }))).toEqual([
      { id: 'fight-involvement', score: 21, weight: 40 },
      { id: 'hero-damage', score: 15, weight: 35 },
      { id: 'tower-damage', score: 0, weight: 20 },
      { id: 'hero-healing', score: 35, weight: 5 },
    ]);
  });

  it('keeps resources, lane farm, deaths and IMP outside positive team output', () => {
    const players = realMatch8749050591Players();
    const baseline = calculateTeamOutputShare(players, 'witch-doctor');
    const changedInputs = calculateTeamOutputShare(players.map((entry) => entry.key === 'witch-doctor'
      ? { ...entry, deaths: 0, netWorth: 200_000, lastHits: 1_000, imp: 100 }
      : entry), 'witch-doctor');

    expect(changedInputs).toEqual(baseline);
  });

  it('raises the share when the player produces more hero damage', () => {
    const players = realMatch8749050591Players();
    const baseline = calculateTeamOutputShare(players, 'witch-doctor');
    const higherDamage = calculateTeamOutputShare(players.map((entry) => entry.key === 'witch-doctor'
      ? { ...entry, heroDamage: 200_000 }
      : entry), 'witch-doctor');

    expect(higherDamage?.score).toBeGreaterThan(baseline?.score ?? 0);
  });

  it('renormalizes weights when a team has no tower damage or healing', () => {
    const players = realMatch8749050591Players().map((entry) => !entry.isRadiant
      ? { ...entry, towerDamage: 0, heroHealing: 0 }
      : entry);
    const direPlayers = players.filter((entry) => !entry.isRadiant);
    const results = direPlayers.map((entry) => calculateTeamOutputShare(players, entry.key));

    expect(results.reduce((total, result) => total + (result?.score ?? 0), 0)).toBe(100);
    expect(results[0]?.components.map(({ id, weight }) => ({ id, weight }))).toEqual([
      { id: 'fight-involvement', weight: 53 },
      { id: 'hero-damage', weight: 47 },
    ]);
  });

  it('requires a complete five-player team', () => {
    const incompletePlayers = realMatch8749050591Players().filter((entry) => entry.key !== 'storm-spirit');

    expect(calculateTeamOutputShare(incompletePlayers, 'witch-doctor')).toBeNull();
  });
});

function player(overrides: Partial<MatchDetailPlayer>): MatchDetailPlayer {
  return {
    key: 'player', accountId: null, playerSlot: 0, isRadiant: true, name: null, heroId: 1,
    kills: 5, deaths: 5, assists: 8, goldPerMinute: 500, xpPerMinute: 550, lastHits: 100, denies: 5,
    heroDamage: 15_000, towerDamage: 1_000, heroHealing: 0, netWorth: 15_000, level: 20, imp: null,
    role: null, position: null, lane: null, award: null, itemIds: [], backpackItemIds: [], neutralItemId: null,
    permanentUpgradeItemIds: { scepterItemId: null, shardItemId: null, moonShardItemId: null },
    abilityBuild: [], hasAbilityBuildData: false, purchaseEvents: [], hasPurchaseEventsData: false,
    minuteSeries: { gold: [], experience: [], netWorth: Array(11).fill(5_000), lastHits: Array(11).fill(5), denies: [], heroDamage: [], imp: [] },
    detailEvents: { kills: 0, deaths: 0, assists: 0, wards: 0, runes: 0, itemUses: 0, wardDestructions: 0 },
    combatEvents: { kills: [], assists: [], deaths: [] },
    dotaPlusLevel: null, totalActions: null,
    ...overrides,
  };
}

function emptySeries(): MatchDetailPlayer['minuteSeries'] {
  return { gold: [], experience: [], netWorth: [], lastHits: [], denies: [], heroDamage: [], imp: [] };
}

function resourceConversionPlayers(resourceShare: number, outputShare: number): MatchDetailPlayer[] {
  return [
    player({
      key: 'selected',
      position: 3,
      netWorth: resourceShare,
      heroDamage: outputShare,
      towerDamage: outputShare,
      assists: outputShare,
      heroHealing: outputShare,
    }),
    player({
      key: 'ally',
      position: 1,
      netWorth: 100 - resourceShare,
      heroDamage: 100 - outputShare,
      towerDamage: 100 - outputShare,
      assists: 100 - outputShare,
      heroHealing: 100 - outputShare,
    }),
    player({ key: 'opponent', position: 3, isRadiant: false }),
  ];
}

function kill(key: string, time: number, actorAccountId: number, targetAccountId: number): MatchTimelineEvent {
  return {
    key,
    time,
    type: 'kill',
    actor: { accountId: actorAccountId, heroId: 1, name: 'Opponent', isRadiant: false },
    target: { accountId: targetAccountId, heroId: 1, name: 'Selected', isRadiant: true },
    isRadiant: false,
    targetIsRadiant: true,
  };
}

function realMatch8749050591Players(): MatchDetailPlayer[] {
  return [
    player({ key: 'sniper', isRadiant: true, position: 4, kills: 22, deaths: 7, assists: 30, netWorth: 83_107, goldPerMinute: 1_841, xpPerMinute: 2_802, heroDamage: 79_765, towerDamage: 12_061, heroHealing: 125, minuteSeries: emptySeries() }),
    player({ key: 'rubick', isRadiant: true, position: 5, kills: 6, deaths: 10, assists: 39, netWorth: 46_889, goldPerMinute: 977, xpPerMinute: 2_284, heroDamage: 24_281, towerDamage: 1_582, heroHealing: 650, minuteSeries: emptySeries() }),
    player({ key: 'shadow-fiend', isRadiant: true, position: 2, kills: 13, deaths: 12, assists: 25, netWorth: 41_732, goldPerMinute: 1_333, xpPerMinute: 2_365, heroDamage: 51_002, towerDamage: 5_229, heroHealing: 0, minuteSeries: laneSeries(11_853, 59), detailEvents: { kills: 13, deaths: 12, assists: 25, wards: 1, runes: 14, itemUses: 0, wardDestructions: 1 } }),
    player({ key: 'templar-assassin', isRadiant: true, position: 1, kills: 6, deaths: 12, assists: 20, netWorth: 41_147, goldPerMinute: 993, xpPerMinute: 1_743, heroDamage: 22_739, towerDamage: 960, heroHealing: 0, minuteSeries: emptySeries() }),
    player({ key: 'necrophos', isRadiant: true, position: 3, kills: 21, deaths: 6, assists: 26, netWorth: 80_411, goldPerMinute: 1_915, xpPerMinute: 2_518, heroDamage: 47_176, towerDamage: 3_332, heroHealing: 11_120, minuteSeries: emptySeries() }),
    player({ key: 'witch-doctor', isRadiant: false, position: 5, kills: 9, deaths: 17, assists: 16, netWorth: 25_623, goldPerMinute: 734, xpPerMinute: 1_557, heroDamage: 35_184, towerDamage: 0, heroHealing: 2_459, minuteSeries: emptySeries() }),
    player({ key: 'muerta', isRadiant: false, position: 1, kills: 16, deaths: 13, assists: 10, netWorth: 56_593, goldPerMinute: 1_699, xpPerMinute: 2_140, heroDamage: 82_616, towerDamage: 0, heroHealing: 0, minuteSeries: emptySeries() }),
    player({ key: 'keeper-of-the-light', isRadiant: false, position: 4, kills: 8, deaths: 8, assists: 18, netWorth: 45_635, goldPerMinute: 1_088, xpPerMinute: 2_224, heroDamage: 32_878, towerDamage: 0, heroHealing: 4_591, minuteSeries: emptySeries() }),
    player({ key: 'windranger', isRadiant: false, position: 3, kills: 10, deaths: 12, assists: 12, netWorth: 40_170, goldPerMinute: 1_452, xpPerMinute: 2_248, heroDamage: 41_338, towerDamage: 5_270, heroHealing: 0, minuteSeries: emptySeries() }),
    player({ key: 'storm-spirit', isRadiant: false, position: 2, kills: 3, deaths: 18, assists: 17, netWorth: 40_229, goldPerMinute: 974, xpPerMinute: 1_437, heroDamage: 42_346, towerDamage: 0, heroHealing: 0, minuteSeries: laneSeries(7_148, 25), detailEvents: { kills: 3, deaths: 18, assists: 16, wards: 0, runes: 6, itemUses: 0, wardDestructions: 1 } }),
  ];
}

function laneSeries(netWorthAtTen: number, lastHitsThroughTen: number): MatchDetailPlayer['minuteSeries'] {
  const netWorth = Array(11).fill(0) as number[];
  const lastHits = Array(11).fill(0) as number[];
  netWorth[10] = netWorthAtTen;
  lastHits[10] = lastHitsThroughTen;
  return { gold: [], experience: [], netWorth, lastHits, denies: [], heroDamage: [], imp: [] };
}
