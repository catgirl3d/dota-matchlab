import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

const DOTACONSTANTS_ABILITIES_URL = 'https://raw.githubusercontent.com/odota/dotaconstants/master/build/abilities.json';
const DOTACONSTANTS_ABILITY_IDS_URL = 'https://raw.githubusercontent.com/odota/dotaconstants/master/build/ability_ids.json';
const DOTA_HERO_LIST_URL = 'https://www.dota2.com/datafeed/herolist?language=english';
const DOTA_HERO_DATA_URL = 'https://www.dota2.com/datafeed/herodata?language=english&hero_id=';
const DOTA_VPK_HERO_FILE_URL = 'https://raw.githubusercontent.com/spirit-bear-productions/dota_vpk_updates/main/scripts/npc/heroes/';
const PLACEHOLDER_PATTERN = /\{s:([^}]+)\}/g;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asFiniteNumber(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function getGenericTalentValue(talentName) {
  const match = /^special_bonus_(?!unique_).+_(-?\d+(?:\.\d+)?)$/.exec(talentName);
  return match ? asFiniteNumber(match[1]) : null;
}

function getResultData(payload) {
  if (!isRecord(payload) || !isRecord(payload.result) || !isRecord(payload.result.data)) {
    throw new Error('Dota datafeed response has no result.data object.');
  }

  return payload.result.data;
}

export function getTalentTemplates(abilities, abilityIds) {
  const idsByName = new Map();
  for (const [id, name] of Object.entries(abilityIds)) {
    if (typeof name === 'string' && Number.isSafeInteger(Number(id))) {
      idsByName.set(name, Number(id));
    }
  }

  const entries = Array.isArray(abilities)
    ? abilities.map((ability) => [undefined, ability])
    : Object.entries(abilities);
  const templates = new Map();

  for (const [key, ability] of entries) {
    if (!isRecord(ability)) {
      continue;
    }

    const name = typeof ability.name === 'string'
      ? ability.name
      : typeof key === 'string' && !Number.isNaN(Number(key))
        ? undefined
        : key;
    const dname = typeof ability.dname === 'string' ? ability.dname : undefined;
    const explicitId = asFiniteNumber(ability.id);
    const keyedId = typeof key === 'string' ? asFiniteNumber(key) : null;
    const id = explicitId ?? keyedId ?? (name ? idsByName.get(name) : undefined);

    if (!name?.startsWith('special_bonus_') || !dname || id === undefined) {
      continue;
    }

    templates.set(name, { id, dname });
  }

  return templates;
}

export function getHeroIds(heroList) {
  const data = getResultData(heroList);
  if (!Array.isArray(data.heroes)) {
    throw new Error('Dota hero list response has no heroes array.');
  }

  const ids = new Set();
  for (const hero of data.heroes) {
    if (!isRecord(hero)) {
      continue;
    }

    const id = asFiniteNumber(hero.id);
    if (id !== null) {
      ids.add(id);
    }
  }

  return [...ids].sort((left, right) => left - right);
}

export function getHeroAbilityFileNames(heroList) {
  const data = getResultData(heroList);
  if (!Array.isArray(data.heroes)) {
    throw new Error('Dota hero list response has no heroes array.');
  }

  const fileNames = new Set();
  for (const hero of data.heroes) {
    if (isRecord(hero) && typeof hero.name === 'string' && hero.name.startsWith('npc_dota_hero_')) {
      fileNames.add(`${hero.name}.txt`);
    }
  }

  return [...fileNames].sort();
}

export function parseKeyValues(source) {
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === '/' && source[index + 1] === '/') {
      index = source.indexOf('\n', index + 2);
      if (index === -1) {
        break;
      }
      continue;
    }
    if (character === '{' || character === '}') {
      tokens.push(character);
      index += 1;
      continue;
    }
    if (character === '"') {
      let value = '';
      index += 1;
      while (index < source.length && source[index] !== '"') {
        if (source[index] === '\\' && index + 1 < source.length) {
          index += 1;
        }
        value += source[index];
        index += 1;
      }
      if (source[index] !== '"') {
        throw new Error('Unterminated quoted KeyValues string.');
      }
      tokens.push(value);
      index += 1;
      continue;
    }

    const start = index;
    while (index < source.length && !/\s|\{|\}/.test(source[index])) {
      index += 1;
    }
    tokens.push(source.slice(start, index));
  }

  let tokenIndex = 0;
  const parseObject = (expectClosingBrace) => {
    const object = new Map();
    while (tokenIndex < tokens.length) {
      if (tokens[tokenIndex] === '}') {
        if (!expectClosingBrace) {
          throw new Error('Unexpected KeyValues closing brace.');
        }
        tokenIndex += 1;
        return object;
      }

      const key = tokens[tokenIndex];
      tokenIndex += 1;
      if (key === '{') {
        throw new Error('KeyValues object is missing a key.');
      }
      if (tokenIndex >= tokens.length) {
        throw new Error(`KeyValues value is missing for ${key}.`);
      }

      const token = tokens[tokenIndex];
      tokenIndex += 1;
      object.set(key, token === '{' ? parseObject(true) : token);
    }
    if (expectClosingBrace) {
      throw new Error('KeyValues object is missing a closing brace.');
    }
    return object;
  };

  return parseObject(false);
}

function getNumericKeyValuesValue(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const match = /^[+-]?\d+(?:\.\d+)?/.exec(value.trim());
  return match ? asFiniteNumber(match[0]) : null;
}

function addTalentBonus(bonuses, talentName, specialValueName, value) {
  if (value === null) {
    return;
  }
  const values = bonuses.get(talentName) ?? new Map();
  if (!values.has(specialValueName)) {
    values.set(specialValueName, value);
  }
  bonuses.set(talentName, values);
}

export function getTalentBonusesFromKeyValues(source) {
  const root = parseKeyValues(source);
  const abilities = root.get('DOTAAbilities');
  if (!(abilities instanceof Map)) {
    throw new Error('KeyValues source has no DOTAAbilities object.');
  }

  const bonuses = new Map();
  for (const [abilityName, ability] of abilities) {
    if (!(ability instanceof Map)) {
      continue;
    }
    const abilityValues = ability.get('AbilityValues');
    if (!(abilityValues instanceof Map)) {
      continue;
    }

    for (const [specialValueName, definition] of abilityValues) {
      if (abilityName.startsWith('special_bonus_')) {
        const directValue = definition instanceof Map ? definition.get('value') : definition;
        addTalentBonus(bonuses, abilityName, specialValueName, getNumericKeyValuesValue(directValue));
      }
      if (!(definition instanceof Map)) {
        continue;
      }

      for (const [linkedTalentName, rawValue] of definition) {
        if (!linkedTalentName.startsWith('special_bonus_')) {
          continue;
        }
        const value = rawValue instanceof Map ? rawValue.get('value') : rawValue;
        addTalentBonus(bonuses, linkedTalentName, specialValueName, getNumericKeyValuesValue(value));
      }
    }
  }

  return bonuses;
}

export function getTalentBonuses(heroData) {
  const data = getResultData(heroData);
  if (!Array.isArray(data.heroes)) {
    throw new Error('Dota hero data response has no heroes array.');
  }

  const bonuses = new Map();
  for (const hero of data.heroes) {
    if (!isRecord(hero) || !Array.isArray(hero.abilities)) {
      continue;
    }

    for (const ability of hero.abilities) {
      if (!isRecord(ability) || !Array.isArray(ability.special_values)) {
        continue;
      }

      for (const specialValue of ability.special_values) {
        if (!isRecord(specialValue) || typeof specialValue.name !== 'string' || !Array.isArray(specialValue.bonuses)) {
          continue;
        }

        for (const bonus of specialValue.bonuses) {
          if (!isRecord(bonus) || typeof bonus.name !== 'string') {
            continue;
          }

          const value = asFiniteNumber(bonus.value);
          if (value === null) {
            continue;
          }

          const values = bonuses.get(bonus.name) ?? new Map();
          const existingValue = values.get(specialValue.name);
          if (existingValue !== undefined) {
            // The datafeed also includes legacy and alternate abilities; keep the main ability's first value.
            continue;
          }
          values.set(specialValue.name, value);
          bonuses.set(bonus.name, values);
        }
      }
    }
  }

  return bonuses;
}

export function getCurrentTalentNames(heroData) {
  return new Set(getCurrentTalentTemplates(heroData).keys());
}

export function getCurrentTalentTemplates(heroData) {
  const data = getResultData(heroData);
  if (!Array.isArray(data.heroes)) {
    throw new Error('Dota hero data response has no heroes array.');
  }

  const templates = new Map();
  for (const hero of data.heroes) {
    if (!isRecord(hero) || !Array.isArray(hero.talents)) {
      continue;
    }

    for (const talent of hero.talents) {
      const id = isRecord(talent) ? asFiniteNumber(talent.id) : null;
      if (
        isRecord(talent)
        && typeof talent.name === 'string'
        && talent.name.startsWith('special_bonus_')
        && typeof talent.name_loc === 'string'
        && talent.name_loc
        && id !== null
      ) {
        templates.set(talent.name, { id, dname: talent.name_loc });
      }
    }
  }

  return templates;
}

export function mergeTalentTemplates(abilitiesTemplates, currentTemplates) {
  const templates = new Map();
  for (const [name, currentTemplate] of currentTemplates) {
    const fallbackTemplate = abilitiesTemplates.get(name);
    templates.set(name, {
      id: currentTemplate.id,
      dname: currentTemplate.dname || fallbackTemplate?.dname,
    });
  }
  return templates;
}

export function resolveTalentDescription(template, specialValues, talentName = '') {
  const missing = [];
  const description = template.replace(PLACEHOLDER_PATTERN, (placeholder, variable, offset) => {
    const specialValueName = variable.startsWith('bonus_') ? variable.slice('bonus_'.length) : variable;
    const value = specialValues?.get(variable)
      ?? specialValues?.get(specialValueName)
      ?? (variable === 'value' ? getGenericTalentValue(talentName) : null);
    if (value === undefined || value === null) {
      missing.push(placeholder);
      return placeholder;
    }

    const precedingCharacter = template[offset - 1];
    const displayedValue = (precedingCharacter === '+' && value > 0) || (precedingCharacter === '-' && value < 0)
      ? Math.abs(value)
      : value;
    return formatNumber(displayedValue);
  });

  return { description, missing };
}

export function buildTalentDescriptions(templates, bonuses, currentTalentNames = templates.keys()) {
  const descriptions = new Map();
  const unresolved = [];

  for (const name of currentTalentNames) {
    const template = templates.get(name);
    if (!template) {
      unresolved.push(`${name}: absent from abilities metadata`);
      continue;
    }

    const { description, missing } = resolveTalentDescription(template.dname, bonuses.get(name), name);
    if (missing.length > 0) {
      unresolved.push(`${name}: ${missing.join(', ')}`);
      continue;
    }

    descriptions.set(template.id, description);
  }

  if (unresolved.length > 0) {
    throw new Error(`Could not resolve ${unresolved.length} talent description(s):\n${unresolved.join('\n')}`);
  }

  return descriptions;
}

export function renderTalentDescriptions(descriptions) {
  const lines = ['export const talentDescriptions: Record<number, string> = {'];
  for (const [id, description] of [...descriptions.entries()].sort(([left], [right]) => left - right)) {
    lines.push(`  ${id}: ${JSON.stringify(description)},`);
  }
  lines.push('};', '');
  return lines.join('\n');
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': 'dota-matchlab-talent-descriptions/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function fetchText(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': 'dota-matchlab-talent-descriptions/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function mapWithConcurrency(values, mapper, limit = 8) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(values[currentIndex]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

function mergeTalentBonuses(primaryBonuses, fallbackBonuses) {
  const bonuses = new Map();
  for (const source of [primaryBonuses, fallbackBonuses]) {
    for (const [talentName, values] of source) {
      const mergedValues = bonuses.get(talentName) ?? new Map();
      for (const [specialValueName, value] of values) {
        if (!mergedValues.has(specialValueName)) {
          mergedValues.set(specialValueName, value);
        }
      }
      bonuses.set(talentName, mergedValues);
    }
  }
  return bonuses;
}

async function readLocalJsonOrFetch(path, fallbackUrl, fetchImpl) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
    console.warn(`${path} is absent; downloading ${fallbackUrl}.`);
    return fetchJson(fallbackUrl, fetchImpl);
  }
}

export async function generateTalentDescriptions({
  rootDir = REPO_ROOT,
  fetchImpl = fetch,
  abilitiesPath = resolve(rootDir, 'abilities.json'),
  abilityIdsPath = resolve(rootDir, 'ability_ids.json'),
  outputPath = resolve(rootDir, 'src/react-app/lib/talent-descriptions.ts'),
} = {}) {
  const [abilities, abilityIds, heroList] = await Promise.all([
    readLocalJsonOrFetch(abilitiesPath, DOTACONSTANTS_ABILITIES_URL, fetchImpl),
    readLocalJsonOrFetch(abilityIdsPath, DOTACONSTANTS_ABILITY_IDS_URL, fetchImpl),
    fetchJson(DOTA_HERO_LIST_URL, fetchImpl),
  ]);
  const heroIds = getHeroIds(heroList);
  const heroFileNames = getHeroAbilityFileNames(heroList);
  const [heroPayloads, heroAbilitySources] = await Promise.all([
    mapWithConcurrency(heroIds, (heroId) => fetchJson(`${DOTA_HERO_DATA_URL}${heroId}`, fetchImpl)),
    mapWithConcurrency(heroFileNames, (fileName) => fetchText(`${DOTA_VPK_HERO_FILE_URL}${fileName}`, fetchImpl)),
  ]);
  const datafeedBonuses = new Map();
  const currentTalentTemplates = new Map();

  for (const heroPayload of heroPayloads) {
    for (const [talentName, template] of getCurrentTalentTemplates(heroPayload)) {
      currentTalentTemplates.set(talentName, template);
    }
    for (const [talentName, values] of getTalentBonuses(heroPayload)) {
      const existingValues = datafeedBonuses.get(talentName) ?? new Map();
      for (const [specialValueName, value] of values) {
        if (existingValues.has(specialValueName)) {
          continue;
        }
        existingValues.set(specialValueName, value);
      }
      datafeedBonuses.set(talentName, existingValues);
    }
  }

  const keyValuesBonuses = new Map();
  for (const source of heroAbilitySources) {
    for (const [talentName, values] of getTalentBonusesFromKeyValues(source)) {
      const existingValues = keyValuesBonuses.get(talentName) ?? new Map();
      for (const [specialValueName, value] of values) {
        if (!existingValues.has(specialValueName)) {
          existingValues.set(specialValueName, value);
        }
      }
      keyValuesBonuses.set(talentName, existingValues);
    }
  }

  const templates = mergeTalentTemplates(getTalentTemplates(abilities, abilityIds), currentTalentTemplates);
  const descriptions = buildTalentDescriptions(templates, mergeTalentBonuses(keyValuesBonuses, datafeedBonuses), currentTalentTemplates.keys());
  await writeFile(outputPath, renderTalentDescriptions(descriptions), 'utf8');
  console.log(`Wrote ${descriptions.size} talent descriptions to ${outputPath}.`);
  return descriptions;
}

async function main() {
  await generateTalentDescriptions();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
