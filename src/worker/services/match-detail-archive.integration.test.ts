import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDatabase } from '../../shared/app-database';
import { importPublicMatchDetail } from './match-detail-archive';
import { loadStratzMatchDetail } from './stratz';

vi.mock('./stratz', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./stratz')>();
  return { ...actual, loadStratzMatchDetail: vi.fn() };
});

const TEST_MATCH_ID = 9_000_000_000_000_001;
const TEST_ACCOUNT_ID = 4_294_967_294;

let client: SupabaseClient<AppDatabase>;
let env: Env;

describe('public match detail integration', () => {
  beforeAll(() => {
    const local = readLocalSupabaseStatus();
    assertLocalApiUrl(local.apiUrl);
    env = {
      CLERK_PUBLISHABLE_KEY: 'pk_integration',
      CLERK_SECRET_KEY: 'sk_integration',
      OPENDOTA_BASE_URL: 'https://api.opendota.com/api',
      STRATZ_API_TOKEN: 'integration-stratz-token',
      SUPABASE_URL: local.apiUrl,
      SUPABASE_PUBLISHABLE_KEY: local.publishableKey,
      SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey,
    };
    client = createClient<AppDatabase>(local.apiUrl, local.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
  });

  beforeEach(async () => {
    vi.mocked(loadStratzMatchDetail).mockReset();
    await deleteTestMatch();
  });

  afterEach(async () => {
    await deleteTestMatch();
  });

  it('passes the production Worker payload through PostgREST and the SQL RPC contract', async () => {
    const rawResponse = {
      data: {
        match: {
          id: TEST_MATCH_ID,
          startDateTime: 1_720_000_000,
          durationSeconds: 2_100,
          didRadiantWin: true,
          gameMode: 'TURBO',
          lobbyType: 'UNRANKED',
          radiantKills: 31,
          direKills: 20,
          players: [{
            matchId: TEST_MATCH_ID,
            steamAccountId: TEST_ACCOUNT_ID,
            playerSlot: 0,
            heroId: 1,
            kills: 9,
            deaths: 2,
            assists: 11,
            goldPerMinute: 700,
            experiencePerMinute: 800,
            numLastHits: 240,
            numDenies: 12,
            heroDamage: 25_000,
            towerDamage: 3_000,
            heroHealing: 100,
            level: 25,
            networth: 24_000,
            leaverStatus: 'NONE',
          }],
        },
      },
    };
    vi.mocked(loadStratzMatchDetail).mockResolvedValue({
      unavailable: false,
      error: null,
      payloads: [{ section: 'players', response: rawResponse }],
    });

    await expect(importPublicMatchDetail(env, TEST_MATCH_ID)).resolves.toEqual({
      matchId: TEST_MATCH_ID,
      status: 'available',
      imported: true,
    });
    expect(loadStratzMatchDetail).toHaveBeenCalledWith('integration-stratz-token', TEST_MATCH_ID);

    const matchResponse = await client
      .from('dota_matches')
      .select('match_id,detail_status,source,duration,game_mode,radiant_score,dire_score')
      .eq('match_id', TEST_MATCH_ID)
      .single();
    expect(matchResponse.error).toBeNull();
    expect(matchResponse.data).toEqual({
      match_id: TEST_MATCH_ID,
      detail_status: 'available',
      source: 'stratz',
      duration: 2_100,
      game_mode: 23,
      radiant_score: 31,
      dire_score: 20,
    });

    const playerResponse = await client
      .from('player_match_stats')
      .select('match_id,account_id,player_slot,hero_id,kills,gold_per_min,xp_per_min,leaver_status')
      .eq('match_id', TEST_MATCH_ID)
      .single();
    expect(playerResponse.error).toBeNull();
    expect(playerResponse.data).toEqual({
      match_id: TEST_MATCH_ID,
      account_id: TEST_ACCOUNT_ID,
      player_slot: 0,
      hero_id: 1,
      kills: 9,
      gold_per_min: 700,
      xp_per_min: 800,
      leaver_status: 0,
    });

    const payloadResponse = await client
      .from('match_provider_payloads')
      .select('provider,payload_kind,payload_section,schema_version,payload')
      .eq('match_id', TEST_MATCH_ID)
      .single();
    expect(payloadResponse.error).toBeNull();
    expect(payloadResponse.data).toEqual({
      provider: 'stratz',
      payload_kind: 'detail',
      payload_section: 'players',
      schema_version: 'stratz.match.detail.v2',
      payload: rawResponse,
    });
  });
});

async function deleteTestMatch(): Promise<void> {
  const response = await client.from('dota_matches').delete().eq('match_id', TEST_MATCH_ID);
  if (response.error) throw new Error(`Failed to clean integration match: ${response.error.message}`);
}

function readLocalSupabaseStatus(): {
  apiUrl: string;
  publishableKey: string;
  serviceRoleKey: string;
} {
  const command = process.platform === 'win32'
    ? {
        executable: process.env.ComSpec ?? 'cmd.exe',
        args: ['/d', '/s', '/c', 'pnpm exec supabase status --output json'],
      }
    : {
        executable: 'pnpm',
        args: ['exec', 'supabase', 'status', '--output', 'json'],
      };
  const output = execFileSync(
    command.executable,
    command.args,
    { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  );
  const jsonStart = output.indexOf('{');
  if (jsonStart < 0) throw new Error('Local Supabase status did not return JSON');
  const status: unknown = JSON.parse(output.slice(jsonStart));
  if (!isObject(status)) throw new Error('Local Supabase status returned an invalid object');

  const storageUrl = readString(status.STORAGE_S3_URL);
  const apiUrl = readString(status.API_URL) ?? (storageUrl ? new URL(storageUrl).origin : null);
  const publishableKey = readString(status.PUBLISHABLE_KEY) ?? readString(status.ANON_KEY);
  const serviceRoleKey = readString(status.SERVICE_ROLE_KEY);
  if (!apiUrl || !publishableKey || !serviceRoleKey) {
    throw new Error('Local Supabase status is missing API credentials');
  }
  return { apiUrl, publishableKey, serviceRoleKey };
}

function assertLocalApiUrl(value: string): void {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '54321') {
    throw new Error(`Integration tests require local Supabase on http://127.0.0.1:54321, received ${url.origin}`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
