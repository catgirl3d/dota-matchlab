import { createClient } from '@supabase/supabase-js';
import type { ClientConfig } from './config';
import { clientConfig } from './config';
import type { AppDatabase } from '../../shared/app-database';

export type AccessTokenProvider = () => Promise<string | null>;

export function createPublicSupabaseClient(config: ClientConfig = clientConfig) {
  assertSupabaseConfig(config);
  return createClient<AppDatabase>(config.supabaseUrl, config.supabasePublishableKey);
}

export function createUserSupabaseClient(
  accessToken: AccessTokenProvider,
  config: ClientConfig = clientConfig,
) {
  assertSupabaseConfig(config);

  return createClient<AppDatabase>(config.supabaseUrl, config.supabasePublishableKey, {
    accessToken,
  });
}

function assertSupabaseConfig(config: ClientConfig) {
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new Error('Supabase client configuration is missing');
  }
}
