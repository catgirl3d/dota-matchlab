import { createClient } from '@supabase/supabase-js';
import type { ClientConfig } from './config';
import { clientConfig } from './config';
import type { Database } from '../../shared/database.types';

export type AccessTokenProvider = () => Promise<string | null>;

export function createUserSupabaseClient(
  accessToken: AccessTokenProvider,
  config: ClientConfig = clientConfig,
) {
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    throw new Error('Supabase client configuration is missing');
  }

  return createClient<Database>(config.supabaseUrl, config.supabasePublishableKey, {
    accessToken,
  });
}
