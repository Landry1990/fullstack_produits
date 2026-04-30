import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export interface ExpirationAlert {
  id: number;
  produit_id: number | null;
  produit_nom: string;
  lot_numero: string | null;
  fournisseur_nom: string | null;
  quantity_remaining: number;
  date_expiration: string | null;
  days_until: number;
  level: 'critical' | 'warning' | 'notice' | 'info';
  level_display: string;
  prix_achat: number;
  prix_vente: number;
  valeur_stock: number;
}

export interface ExpirationAlertsResponse {
  alerts: ExpirationAlert[];
  stats: {
    total_alerts: number;
    critical_count: number;
    warning_count: number;
    notice_count: number;
    total_valeur: number;
    days_checked: number;
  };
  date_reference: string;
}

interface UseExpirationAlertsOptions {
  days?: number;
  minQuantity?: number;
  criticalOnly?: boolean;
  enabled?: boolean;
  showToasts?: boolean;
}

export const useExpirationAlerts = (options: UseExpirationAlertsOptions = {}) => {
  const { t } = useTranslation(['stock', 'common']);
  const {
    days = 30,
    minQuantity = 1,
    criticalOnly = false,
    enabled = true,
    showToasts = false,
  } = options;

  return useQuery<ExpirationAlertsResponse>({
    queryKey: ['expiration-alerts', days, minQuantity, criticalOnly],
    queryFn: async () => {
      const params = new URLSearchParams({
        days: String(days),
        min_quantity: String(minQuantity),
        critical_only: String(criticalOnly),
      });

      const response = await api.get<ExpirationAlertsResponse>(`stock-lots/alerts_expiration/?${params}`);
      return response.data;
    },
    enabled,
    staleTime: 1000 * 60 * 5,
    refetchInterval: enabled ? 1000 * 60 * 10 : false,
    refetchIntervalInBackground: false,
    select: (data) => {
      if (showToasts && data.alerts.length > 0) {
        const criticalAlerts = data.alerts.filter(a => a.level === 'critical');

        if (criticalAlerts.length > 0) {
          toast.error(
            t('expiration.critical_toast', {
              count: criticalAlerts.length,
              defaultValue: `🚨 ${criticalAlerts.length} produit(s) expirent dans ≤ 7 jours !`,
            }),
            {
              duration: 8000,
              id: 'expiration-critical-alert',
              icon: '⚠️',
              style: {
                border: '2px solid #ef4444',
                background: '#fee2e2',
                fontWeight: 'bold',
              },
            }
          );
        }

        if (data.stats.total_alerts > 5 && criticalAlerts.length === 0) {
          toast(
            t('expiration.summary_toast', {
              count: data.stats.total_alerts,
              valeur: data.stats.total_valeur.toFixed(2),
              defaultValue: `📦 ${data.stats.total_alerts} produits en péremption imminente (valeur: ${data.stats.total_valeur.toFixed(2)} F)`,
            }),
            {
              duration: 5000,
              id: 'expiration-summary',
              icon: '📦',
              style: {
                border: '1px solid #f97316',
                background: '#ffedd5',
              },
            }
          );
        }
      }

      return data;
    },
  });
};

export const useCriticalExpirationAlerts = (enabled = true, showToasts = false) => {
  return useExpirationAlerts({
    days: 7,
    criticalOnly: true,
    enabled,
    showToasts,
  });
};

export const useLoginExpirationAlerts = () => {
  const { data, isSuccess } = useExpirationAlerts({
    days: 14,
    enabled: true,
    showToasts: false,
  });

  const showLoginAlerts = () => {
    if (!isSuccess || !data) return;

    const { alerts } = data;

    if (alerts.length === 0) return;

    const critical = alerts.filter(a => a.level === 'critical');
    const warning = alerts.filter(a => a.level === 'warning');
    const others = alerts.filter(a => a.level === 'notice' || a.level === 'info');

    if (critical.length > 0) {
      toast.error(
        (t) => (
          <div
            onClick={() => toast.dismiss(t.id)}
            style={{ cursor: 'pointer' }}
          >
            <strong>🚨 ALERTE PÉREMPTION CRITIQUE</strong>
            <br />
            <span>{critical.length} produit(s) expirent dans ≤ 7 jours</span>
            <br />
            <small style={{ opacity: 0.8 }}>Cliquez pour fermer</small>
          </div>
        ),
        {
          duration: Infinity,
          id: 'login-expiration-critical',
          style: {
            border: '3px solid #dc2626',
            background: '#fef2f2',
            color: '#991b1b',
            fontWeight: 'bold',
            minWidth: '350px',
          },
        }
      );

      try {
        const audio = new Audio('/sounds/alert-critical.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch {
        // Ignore
      }
    }

    if (warning.length > 0) {
      toast(
        (t) => (
          <div onClick={() => toast.dismiss(t.id)} style={{ cursor: 'pointer' }}>
            <strong>⚠️ Péremption imminente</strong>
            <br />
            <span>{warning.length} produit(s) expirent dans 8-14 jours</span>
          </div>
        ),
        {
          duration: 10000,
          id: 'login-expiration-warning',
          style: {
            border: '2px solid #f97316',
            background: '#fff7ed',
            color: '#c2410c',
            minWidth: '300px',
          },
        }
      );
    }

    if (others.length > 0) {
      toast.success(
        `📦 ${others.length} autre(s) produit(s) en surveillance péremption`,
        {
          duration: 5000,
          id: 'login-expiration-others',
        }
      );
    }
  };

  return { data, showLoginAlerts, stats: data?.stats };
};
