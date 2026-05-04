import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

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
}

export const useExpirationAlerts = (options: UseExpirationAlertsOptions = {}) => {
  const {
    days = 30,
    minQuantity = 1,
    criticalOnly = false,
    enabled = true,
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
  });
};
