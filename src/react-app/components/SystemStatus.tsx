import type { ServiceHealthStatus, SystemHealth } from '../../shared/health';
import { useTranslation } from '../lib/i18n';

type SystemStatusProps = {
  health?: SystemHealth;
  isLoading: boolean;
  isRefreshing: boolean;
  hasError: boolean;
  onRefresh: () => void;
};

export function SystemStatus({
  health,
  isLoading,
  isRefreshing,
  hasError,
  onRefresh,
}: SystemStatusProps) {
  const { t } = useTranslation();
  const supabaseStatus = health?.services.supabase.status;

  const statusLabels: Record<ServiceHealthStatus, string> = {
    ok: t('statusOnline'),
    error: t('statusError'),
    not_configured: t('statusNotConfigured'),
  };

  return (
    <section className="status-panel" aria-labelledby="status-heading">
      <div className="section-heading">
        <p className="eyebrow">SYSTEM / 00</p>
        <h2 id="status-heading">{t('diagnosticHeading')}</h2>
      </div>

      <div className="status-list">
        <StatusRow
          label="Cloudflare Worker"
          status={hasError ? 'error' : health?.services.worker}
          pending={isLoading}
          statusLabels={statusLabels}
          checkingLabel={t('statusChecking')}
        />
        <StatusRow
          label="Supabase RPC"
          status={hasError ? 'error' : supabaseStatus}
          pending={isLoading}
          statusLabels={statusLabels}
          checkingLabel={t('statusChecking')}
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
        {isRefreshing ? t('diagnosticChecking') : t('diagnosticRetry')}
      </button>
    </section>
  );
}

type StatusRowProps = {
  label: string;
  status?: ServiceHealthStatus | 'ok';
  pending: boolean;
  detail?: string;
  statusLabels: Record<ServiceHealthStatus, string>;
  checkingLabel: string;
};

function StatusRow({ label, status, pending, detail, statusLabels, checkingLabel }: StatusRowProps) {
  const normalizedStatus = pending ? undefined : status;
  const labelText = normalizedStatus
    ? statusLabels[normalizedStatus]
    : checkingLabel;

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

