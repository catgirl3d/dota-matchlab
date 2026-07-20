import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTalentDescriptions,
  getCurrentTalentNames,
  getCurrentTalentTemplates,
  getHeroIds,
  getTalentBonuses,
  getTalentBonusesFromKeyValues,
  getTalentTemplates,
  getHeroAbilityFileNames,
  mergeTalentTemplates,
  renderTalentDescriptions,
} from './generate-talent-descriptions.mjs';

test('builds current talent descriptions from dotaconstants templates and datafeed bonuses', () => {
  const templates = getTalentTemplates({
    special_bonus_unique_spectre_2: { dname: '+{s:bonus_bonus_damage} Desolate Damage' },
    special_bonus_unique_spectre_3: { dname: '-{s:bonus_AbilityCooldown}s Spectral Dagger Cooldown' },
    special_bonus_movement_speed: { dname: '+30 Movement Speed' },
  }, {
    6900: 'special_bonus_unique_spectre_2',
    6901: 'special_bonus_unique_spectre_3',
    6002: 'special_bonus_movement_speed',
  });
  const bonuses = new Map([
    ['special_bonus_unique_spectre_2', new Map([['bonus_damage', 12]])],
    ['special_bonus_unique_spectre_3', new Map([['AbilityCooldown', -4]])],
  ]);

  const descriptions = buildTalentDescriptions(templates, bonuses);

  assert.deepEqual([...descriptions.entries()], [
    [6900, '+12 Desolate Damage'],
    [6901, '-4s Spectral Dagger Cooldown'],
    [6002, '+30 Movement Speed'],
  ]);
  assert.equal(renderTalentDescriptions(descriptions), [
    'export const talentDescriptions: Record<number, string> = {',
    '  6002: "+30 Movement Speed",',
    '  6900: "+12 Desolate Damage",',
    '  6901: "-4s Spectral Dagger Cooldown",',
    '};',
    '',
  ].join('\n'));
});

test('resolves the value placeholder of standard talents from their canonical ID', () => {
  const templates = getTalentTemplates({
    special_bonus_attack_range_75: { id: 6010, dname: '+{s:value} Attack Range' },
  }, {});

  assert.deepEqual(
    [...buildTalentDescriptions(templates, new Map()).entries()],
    [[6010, '+75 Attack Range']],
  );
});

test('uses an exact special-value key for a standalone talent ability', () => {
  const templates = getTalentTemplates({
    special_bonus_unique_beastmaster_5: { id: 506, dname: '+{s:bonus_ms} Movespeed' },
  }, {});

  assert.deepEqual(
    [...buildTalentDescriptions(templates, new Map([
      ['special_bonus_unique_beastmaster_5', new Map([['bonus_ms', 15]])],
    ])).entries()],
    [[506, '+15 Movespeed']],
  );
});

test('reads a flat local abilities list with embedded IDs', () => {
  const templates = getTalentTemplates([
    { id: 7777, name: 'special_bonus_unique_test', dname: '+{s:bonus_damage} Test Damage' },
  ], {});
  const descriptions = buildTalentDescriptions(templates, new Map([
    ['special_bonus_unique_test', new Map([['damage', 25]])],
  ]));

  assert.deepEqual([...descriptions.entries()], [[7777, '+25 Test Damage']]);
});

test('collects talent values from the official hero datafeed structure', () => {
  const heroList = { result: { data: { heroes: [{ id: 67, name: 'npc_dota_hero_spectre' }, { id: 1, name: 'npc_dota_hero_antimage' }, { id: 67, name: 'npc_dota_hero_spectre' }] } } };
  const heroData = {
    result: {
      data: {
        heroes: [{
          talents: [{ id: 6900, name: 'special_bonus_unique_spectre_2', name_loc: '+{s:bonus_bonus_damage} Desolate Damage' }, { name: 'spectre_desolate' }],
          abilities: [{
            special_values: [{
              name: 'bonus_damage',
              bonuses: [{ name: 'special_bonus_unique_spectre_2', value: 12 }],
            }],
          }],
        }],
      },
    },
  };

  assert.deepEqual(getHeroIds(heroList), [1, 67]);
  assert.deepEqual(getHeroAbilityFileNames(heroList), ['npc_dota_hero_antimage.txt', 'npc_dota_hero_spectre.txt']);
  assert.deepEqual([...getCurrentTalentNames(heroData)], ['special_bonus_unique_spectre_2']);
  assert.deepEqual([...getCurrentTalentTemplates(heroData).entries()], [[
    'special_bonus_unique_spectre_2',
    { id: 6900, dname: '+{s:bonus_bonus_damage} Desolate Damage' },
  ]]);
  assert.deepEqual(
    [...getTalentBonuses(heroData).entries()].map(([name, values]) => [name, [...values.entries()]]),
    [['special_bonus_unique_spectre_2', [['bonus_damage', 12]]]],
  );
});

test('parses bonus values from split Valve KeyValues ability files', () => {
  const source = `"DOTAAbilities"
{
  "naga_siren_reel_in"
  {
    "AbilityValues"
    {
      "pull_strength"
      {
        "value" "200"
        "special_bonus_unique_naga_siren_reel_in_speed" "+125"
      }
    }
  }
  "special_bonus_unique_beastmaster_5"
  {
    "AbilityValues"
    {
      "bonus_ms" "15"
    }
  }
}`;

  assert.deepEqual(
    [...getTalentBonusesFromKeyValues(source).entries()].map(([name, values]) => [name, [...values.entries()]]),
    [
      ['special_bonus_unique_naga_siren_reel_in_speed', [['pull_strength', 125]]],
      ['special_bonus_unique_beastmaster_5', [['bonus_ms', 15]]],
    ],
  );
});

test('uses the current datafeed template and ID over stale local ability metadata', () => {
  const templates = mergeTalentTemplates(
    new Map([['special_bonus_unique_tiny_6', { id: 558, dname: '+{s:bonus_attack_speed_reduction} Old Talent' }]]),
    new Map([['special_bonus_unique_tiny_6', { id: 558, dname: '+{s:bonus_attack_count} Tree Grab Attacks' }]]),
  );

  assert.deepEqual([...templates.entries()], [[
    'special_bonus_unique_tiny_6',
    { id: 558, dname: '+{s:bonus_attack_count} Tree Grab Attacks' },
  ]]);
});

test('uses the first bonus when the datafeed also exposes a legacy ability variant', () => {
  const heroData = {
    result: {
      data: {
        heroes: [{
          abilities: [
            {
              special_values: [{
                name: 'ghostship_absorb',
                bonuses: [{ name: 'special_bonus_unique_kunkka_rum', value: 15 }],
              }],
            },
            {
              special_values: [{
                name: 'ghostship_absorb',
                bonuses: [{ name: 'special_bonus_unique_kunkka_rum', value: 8 }],
              }],
            },
          ],
        }],
      },
    },
  };

  assert.deepEqual(
    [...getTalentBonuses(heroData).get('special_bonus_unique_kunkka_rum').entries()],
    [['ghostship_absorb', 15]],
  );
});

test('fails generation instead of emitting unresolved template variables', () => {
  const templates = getTalentTemplates({
    special_bonus_unique_test: { id: 7777, dname: '+{s:bonus_missing} Test Damage' },
  }, {});

  assert.throws(
    () => buildTalentDescriptions(templates, new Map()),
    /special_bonus_unique_test: \{s:bonus_missing\}/,
  );
});

test('does not generate descriptions for legacy templates absent from the current hero datafeed', () => {
  const templates = getTalentTemplates({
    special_bonus_current: { id: 111, dname: '+10 Current' },
    special_bonus_legacy: { id: 222, dname: '+{s:bonus_missing} Legacy' },
  }, {});

  assert.deepEqual(
    [...buildTalentDescriptions(templates, new Map(), new Set(['special_bonus_current'])).entries()],
    [[111, '+10 Current']],
  );
});
