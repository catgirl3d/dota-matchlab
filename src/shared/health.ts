export type ServiceHealthStatus = 'ok' | 'error' | 'not_configured';

export type SupabaseHealth = {
  status: ServiceHealthStatus;
  latencyMs: number;
  statusCode?: number;
};

export type SystemHealth = {
  status: 'ok' | 'degraded';
  checkedAt: string;
  services: {
    worker: 'ok';
    supabase: SupabaseHealth;
  };
};
