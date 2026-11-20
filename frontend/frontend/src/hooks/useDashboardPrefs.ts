import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gooeyToast } from 'goey-toast';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

/**
 * Préférences d'affichage du tableau de bord (persistées par utilisateur).
 * Convention : clé absente ou `true` = widget visible ; `false` = masqué.
 * Le backend purge les `true` pour garder le JSON minimal.
 */
export type DashboardPrefs = Record<string, boolean>;

export interface DashboardWidget {
  key: string;
  labelKey: string;
}

export interface DashboardWidgetGroup {
  group: string;
  groupLabelKey: string;
  widgets: DashboardWidget[];
}

export const DASHBOARD_WIDGET_GROUPS: DashboardWidgetGroup[] = [
  {
    group: 'overview',
    groupLabelKey: 'customize.groups.overview',
    widgets: [
      { key: 'overview.kpis', labelKey: 'customize.widgets.overview_kpis' },
      { key: 'overview.reappro', labelKey: 'customize.widgets.overview_reappro' },
      { key: 'overview.revenue', labelKey: 'customize.widgets.overview_revenue' },
      { key: 'overview.hourly', labelKey: 'customize.widgets.overview_hourly' },
      { key: 'overview.pnl', labelKey: 'customize.widgets.overview_pnl' },
      { key: 'overview.stockouts', labelKey: 'customize.widgets.overview_stockouts' },
    ],
  },
  {
    group: 'stock',
    groupLabelKey: 'customize.groups.stock',
    widgets: [
      { key: 'stock.expiring', labelKey: 'customize.widgets.stock_expiring' },
      { key: 'stock.dormant', labelKey: 'customize.widgets.stock_dormant' },
      { key: 'stock.overstock', labelKey: 'customize.widgets.stock_overstock' },
      { key: 'stock.promis', labelKey: 'customize.widgets.stock_promis' },
      { key: 'stock.reappro', labelKey: 'customize.widgets.stock_reappro' },
      { key: 'stock.low', labelKey: 'customize.widgets.stock_low' },
    ],
  },
  {
    group: 'finance',
    groupLabelKey: 'customize.groups.finance',
    widgets: [
      { key: 'finance.ug', labelKey: 'customize.widgets.finance_ug' },
      { key: 'finance.echeances', labelKey: 'customize.widgets.finance_echeances' },
    ],
  },
];

const QUERY_KEY = ['dashboard-prefs'] as const;

export function useDashboardPrefs() {
  const queryClient = useQueryClient();
  const { t } = useTranslation(['dashboard', 'common']);

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<DashboardPrefs> => {
      const res = await api.get('users/dashboard-prefs/');
      return (res.data ?? {}) as DashboardPrefs;
    },
    staleTime: 1000 * 60 * 5,
  });

  const prefs = useMemo(() => query.data ?? {}, [query.data]);

  const isVisible = useCallback(
    (key: string) => prefs[key] !== false,
    [prefs]
  );

  const mutation = useMutation({
    mutationFn: async (patch: Record<string, boolean> | { reset: true }) => {
      const res = await api.patch('users/dashboard-prefs/', patch);
      return res.data as DashboardPrefs;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<DashboardPrefs>(QUERY_KEY);
      if ('reset' in patch) {
        queryClient.setQueryData<DashboardPrefs>(QUERY_KEY, {});
      } else {
        const next: DashboardPrefs = { ...(previous ?? {}), ...patch };
        for (const k of Object.keys(next)) {
          if (next[k] === true) delete next[k];
        }
        queryClient.setQueryData<DashboardPrefs>(QUERY_KEY, next);
      }
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
      gooeyToast.error(t('customize.save_error'));
    },
    onSettled: (data) => {
      if (data !== undefined) {
        queryClient.setQueryData(QUERY_KEY, data);
      }
    },
  });

  const setVisible = useCallback(
    (key: string, visible: boolean) => mutation.mutate({ [key]: visible }),
    [mutation]
  );

  const resetAll = useCallback(() => mutation.mutate({ reset: true }), [mutation]);

  return { prefs, isVisible, setVisible, resetAll, isLoading: query.isLoading };
}
