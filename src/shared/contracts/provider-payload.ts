import * as v from 'valibot';
import { isShallowObject, type JsonObject } from './json';

const NonEmptyStringSchema = v.pipe(v.string(), v.minLength(1));
const DefinedUnknownSchema = v.pipe(v.unknown(), v.check((value) => value !== undefined, 'Payload is required'));

export const ProviderPayloadRowSchema = v.object({
  provider: v.picklist(['stratz', 'opendota']),
  payload_kind: v.picklist(['history', 'detail']),
  payload_section: NonEmptyStringSchema,
  payload: DefinedUnknownSchema,
  schema_version: v.nullable(v.string()),
  fetched_at: v.string(),
});

export type ProviderPayloadRow = v.InferOutput<typeof ProviderPayloadRowSchema>;

export const STRATZ_HISTORY_SCHEMA_VERSION = 'stratz.match.history.v1';
export const STRATZ_DETAIL_SCHEMA_VERSION = 'stratz.match.detail.v2';

const DETAIL_SECTIONS = new Set([
  'metadata',
  'players',
  'player_stats',
  'player_playback',
  'match_playback',
]);

export type RoutedStratzPayload = {
  kind: 'history' | 'detail';
  section: string;
  match: JsonObject;
  legacySchema: boolean;
};

export function parseProviderPayloadRow(value: unknown): ProviderPayloadRow | null {
  const parsed = v.safeParse(ProviderPayloadRowSchema, value);
  return parsed.success ? parsed.output : null;
}

export function routeStratzPayload(row: ProviderPayloadRow): RoutedStratzPayload | null {
  if (row.provider !== 'stratz') return null;

  if (
    row.payload_kind === 'history'
    && row.payload_section === 'match'
    && supportsSchemaVersion(row.schema_version, STRATZ_HISTORY_SCHEMA_VERSION)
    && isShallowObject(row.payload)
  ) {
    return {
      kind: 'history',
      section: row.payload_section,
      match: row.payload,
      legacySchema: row.schema_version === null,
    };
  }

  if (
    row.payload_kind === 'detail'
    && DETAIL_SECTIONS.has(row.payload_section)
    && supportsSchemaVersion(row.schema_version, STRATZ_DETAIL_SCHEMA_VERSION)
    && isShallowObject(row.payload)
    && isShallowObject(row.payload.data)
    && isShallowObject(row.payload.data.match)
  ) {
    return {
      kind: 'detail',
      section: row.payload_section,
      match: row.payload.data.match,
      legacySchema: row.schema_version === null,
    };
  }

  return null;
}

function supportsSchemaVersion(version: string | null, expected: string): boolean {
  return version === null || version === expected;
}
