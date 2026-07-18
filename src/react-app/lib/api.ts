import type { SystemHealth } from '../../shared/health';

function isSystemHealth(value: unknown): value is SystemHealth {
  if (typeof value !== 'object' || value === null || !('services' in value)) {
    return false;
  }

  const services = value.services;
  return (
    typeof services === 'object' &&
    services !== null &&
    'worker' in services &&
    services.worker === 'ok' &&
    'supabase' in services
  );
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const response = await fetch('/api/health', {
    headers: { Accept: 'application/json' },
  });
  const payload: unknown = await response.json();

  if (!isSystemHealth(payload)) {
    throw new Error('Health endpoint returned an invalid response');
  }

  return payload;
}
