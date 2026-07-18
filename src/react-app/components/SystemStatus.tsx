import type { ServiceHealthStatus, SystemHealth } from '../../shared/health';

type SystemStatusProps = {
  health?: SystemHealth;
  isLoading: boolean;
  isRefreshing: boolean;
  hasError: boolean;
  onRefresh: () => void;
};

const statusLabels: Record<ServiceHealthStatus, string> = {
  ok: 'в сети',
  error: 'ошибка',
  not_configured: 'не настроено',
};

export function SystemStatus({
  health,
  isLoading,
  isRefreshing,
  hasError,
  onRefresh,
}: SystemStatusProps) {
  const supabaseStatus = health?.services.supabase.status;

  return (
    <section className="status-panel" aria-labelledby="status-heading">
      <div className="section-heading">
        <p className="eyebrow">SYSTEM / 00</p>
        <h2 id="status-heading">Контур запуска</h2>
      </div>

      <div className="status-list">
        <StatusRow
          label="Cloudflare Worker"
          status={hasError ? 'error' : health?.services.worker}
          pending={isLoading}
        />
        <StatusRow
          label="Supabase RPC"
          status={hasError ? 'error' : supabaseStatus}
          pending={isLoading}
          detail={
            health && supabaseStatus === 'ok'
              ? `${health.services.supabase.latencyMs} ms`
              : undefined
          }
        />
      </div>

      <button
        className="text-button"
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        {isRefreshing ? 'Проверяем…' : 'Повторить диагностику'}
      </button>
    </section>
  );
}

type StatusRowProps = {
  label: string;
  status?: ServiceHealthStatus | 'ok';
  pending: boolean;
  detail?: string;
};

function StatusRow({ label, status, pending, detail }: StatusRowProps) {
  const normalizedStatus = pending ? undefined : status;
  const labelText = normalizedStatus
    ? statusLabels[normalizedStatus]
    : 'проверка';

  return (
    <div className="status-row">
      <span
        className={`status-dot status-dot--${normalizedStatus ?? 'pending'}`}
        aria-hidden="true"
      />
      <span className="status-label">{label}</span>
      <span className="status-value">{detail ?? labelText}</span>
    </div>
  );
}
