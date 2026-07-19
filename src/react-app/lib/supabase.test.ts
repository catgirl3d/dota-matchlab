import { describe, expect, it } from 'vitest';
import { createPublicSupabaseClient, createUserSupabaseClient } from './supabase';

describe('createUserSupabaseClient', () => {
  it('fails before creating a client with incomplete public configuration', () => {
    expect(() =>
      createUserSupabaseClient(async () => null, {
        clerkPublishableKey: '',
        supabaseUrl: '',
        supabasePublishableKey: '',
      }),
    ).toThrow('Supabase client configuration is missing');
  });

  it('creates a user-scoped client without a service role key', () => {
    const client = createUserSupabaseClient(async () => 'clerk-session-token', {
      clerkPublishableKey: 'pk_test_example',
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'sb_publishable_example',
    });

    expect(client).toBeDefined();
  });

  it('creates an anonymous read client from the publishable key', () => {
    const client = createPublicSupabaseClient({
      clerkPublishableKey: '',
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'sb_publishable_example',
    });

    expect(client).toBeDefined();
  });
});
