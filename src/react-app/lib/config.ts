export type ClientConfig = {
  clerkPublishableKey: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export const clientConfig: ClientConfig = {
  clerkPublishableKey:
    import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim() ?? '',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL?.trim() ?? '',
  supabasePublishableKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '',
};

export const hasClerkConfig = clientConfig.clerkPublishableKey.length > 0;
