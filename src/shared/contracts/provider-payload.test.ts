import { describe, expect, it } from 'vitest';
import {
  parseProviderPayloadRow,
  routeStratzPayload,
} from './provider-payload';

describe('provider payload routing', () => {
  it('decodes known STRATZ history and detail schema versions', () => {
    expect(routeStratzPayload(payloadRow({
      payload_kind: 'history',
      payload_section: 'match',
      schema_version: 'stratz.match.history.v1',
      payload: { players: [] },
    }))).toMatchObject({ kind: 'history', section: 'match', legacySchema: false });
    expect(routeStratzPayload(payloadRow({
      payload_kind: 'detail',
      payload_section: 'players',
      schema_version: 'stratz.match.detail.v2',
      payload: { data: { match: { players: [] } } },
    }))).toMatchObject({ kind: 'detail', section: 'players', legacySchema: false });
  });

  it('supports nullable legacy versions only for known STRATZ routes', () => {
    expect(routeStratzPayload(payloadRow({
      payload_kind: 'history',
      payload_section: 'match',
      schema_version: null,
      payload: { players: [] },
    }))).toMatchObject({ kind: 'history', legacySchema: true });
    expect(routeStratzPayload(payloadRow({
      payload_kind: 'detail',
      payload_section: 'players',
      schema_version: null,
      payload: { data: { match: { players: [] } } },
    }))).toMatchObject({ kind: 'detail', legacySchema: true });
  });

  it('does not interpret unknown versions, wrong discriminators, or malformed raw JSON', () => {
    expect(routeStratzPayload(payloadRow({
      payload_kind: 'detail',
      payload_section: 'players',
      schema_version: 'stratz.match.detail.v3',
      payload: { data: { match: { players: [] } } },
    }))).toBeNull();
    expect(routeStratzPayload(payloadRow({
      provider: 'opendota',
      payload_kind: 'detail',
      payload_section: 'players',
      schema_version: 'stratz.match.detail.v2',
      payload: { data: { match: { players: [] } } },
    }))).toBeNull();
    expect(routeStratzPayload(payloadRow({
      payload_kind: 'history',
      payload_section: 'players',
      schema_version: null,
      payload: { players: [] },
    }))).toBeNull();
    expect(routeStratzPayload(payloadRow({
      payload_kind: 'detail',
      payload_section: 'players',
      schema_version: 'stratz.match.detail.v2',
      payload: ['not', 'an', 'envelope'],
    }))).toBeNull();
  });
});

function payloadRow(overrides: Record<string, unknown>) {
  const parsed = parseProviderPayloadRow({
    provider: 'stratz',
    payload_kind: 'history',
    payload_section: 'match',
    payload: { players: [] },
    schema_version: 'stratz.match.history.v1',
    fetched_at: '2026-07-20T00:00:00.000Z',
    ...overrides,
  });
  if (!parsed) throw new Error('Test payload row must be valid');
  return parsed;
}
