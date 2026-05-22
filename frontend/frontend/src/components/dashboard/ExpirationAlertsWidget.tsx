import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, Package, Clock, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useExpirationAlerts } from '../../hooks/useExpirationAlerts';
import { formatCurrency } from '../../utils/formatters';

interface ExpirationAlertsWidgetProps {
  className?: string;
}

const LEVEL_COLORS = {
  critical: {
    bg: 'bg-error/10',
    border: 'border-red-200',
    text: 'text-error',
    badge: 'bg-error/20 text-red-800',
    icon: 'text-red-500',
  },
  warning: {
    bg: 'bg-warning/10',
    border: 'border-orange-200',
    text: 'text-warning',
    badge: 'bg-warning/20 text-orange-800',
    icon: 'text-orange-500',
  },
  notice: {
    bg: 'bg-warning/10',
    border: 'border-amber-200',
    text: 'text-warning',
    badge: 'bg-warning/20 text-amber-800',
    icon: 'text-amber-500',
  },
  info: {
    bg: 'bg-info/10',
    border: 'border-blue-200',
    text: 'text-info',
    badge: 'bg-info/20 text-blue-800',
    icon: 'text-blue-500',
  },
};

export default function ExpirationAlertsWidget({ className = '' }: ExpirationAlertsWidgetProps) {
  const { t } = useTranslation(['stock', 'common']);
  const [expanded, setExpanded] = useState(false);
  const [daysFilter, setDaysFilter] = useState<7 | 14 | 30>(7);

  const { data, isLoading, error } = useExpirationAlerts({
    days: daysFilter,
    enabled: true,
  });

  const currentLocale = t('common:locale', { defaultValue: 'fr-FR' });
  const currencySymbol = t('common:currency_symbol', { defaultValue: 'F' });
  const formatCurrencyLocal = (val: number) => formatCurrency(val, currentLocale, currencySymbol);

  if (isLoading) {
    return (
      <div className={`bg-base-100 rounded-2xl shadow-sm border border-base-200 p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Package className="size-5 text-base-content/50" />
          <span className="text-sm font-semibold text-base-content/70">{t('expiration.widget_title', { defaultValue: 'Alertes Péremption' })}</span>
        </div>
        <div className="space-y-2">
          <div className="h-12 bg-base-200 animate-pulse rounded-lg" />
          <div className="h-12 bg-base-200 animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`bg-error/10 rounded-2xl shadow-sm border border-red-100 p-4 ${className}`}>
        <div className="flex items-center gap-2 text-error">
          <AlertTriangle className="size-5" />
          <span className="text-sm font-medium">{t('expiration.error_loading', { defaultValue: 'Erreur chargement alertes' })}</span>
        </div>
      </div>
    );
  }

  const { alerts, stats } = data;
  const hasAlerts = alerts.length > 0;

  // Limiter l'affichage
  const displayAlerts = expanded ? alerts : alerts.slice(0, 3);
  const hasMore = alerts.length > 3;

  if (!hasAlerts) {
    return (
      <div className={`bg-success/10 rounded-2xl shadow-sm border border-emerald-100 p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="size-5 text-emerald-500" />
            <span className="text-sm font-semibold text-success">
              {t('expiration.no_alerts', { defaultValue: 'Aucune alerte péremption' })}
            </span>
          </div>
          <div className="flex gap-1">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDaysFilter(d as 7 | 14 | 30)}
                className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                  daysFilter === d
                    ? 'bg-emerald-500 text-white'
                    : 'bg-success/20 text-success hover:bg-emerald-200'
                }`}
              >
                {d}j
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-success mt-2">
          {t('expiration.all_good', { days: daysFilter, defaultValue: `Aucun produit n'expire dans les ${daysFilter} prochains jours` })}
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-base-100 rounded-2xl shadow-sm border border-base-200 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-base-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${stats.critical_count > 0 ? 'bg-error/20' : stats.warning_count > 0 ? 'bg-warning/20' : 'bg-warning/20'}`}>
              <AlertTriangle className={`size-5 ${stats.critical_count > 0 ? 'text-red-500' : stats.warning_count > 0 ? 'text-orange-500' : 'text-amber-500'}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-base-content">
                {t('expiration.widget_title', { defaultValue: 'Alertes Péremption' })}
              </h3>
              <p className="text-xs text-base-content/60">
                {stats.total_alerts} alerte{stats.total_alerts > 1 ? 's' : ''} • {formatCurrencyLocal(stats.total_valeur)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filtres jours */}
            <div className="flex gap-1 bg-base-200 rounded-lg p-1">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setDaysFilter(d as 7 | 14 | 30)}
                  className={`px-2 py-1 text-xs rounded-md transition-colors font-medium ${
                    daysFilter === d
                      ? 'bg-base-100 text-base-content shadow-sm'
                      : 'text-base-content/60 hover:text-base-content'
                  }`}
                >
                  {d}j
                </button>
              ))}
            </div>

            <Link
              to="/app/perimes"
              className="p-2 text-base-content/50 hover:text-base-content/70 hover:bg-base-200 rounded-lg transition-colors"
              title={t('expiration.view_all', { defaultValue: 'Voir tous les périmés' })}
            >
              <ExternalLink className="size-4" />
            </Link>
          </div>
        </div>

        {/* Badges de statistiques */}
        <div className="flex gap-2 mt-3">
          {stats.critical_count > 0 && (
            <span className="px-2 py-1 text-xs font-bold bg-error/20 text-error rounded-full">
              🚨 {stats.critical_count} critique{stats.critical_count > 1 ? 's' : ''}
            </span>
          )}
          {stats.warning_count > 0 && (
            <span className="px-2 py-1 text-xs font-bold bg-warning/20 text-warning rounded-full">
              ⚠️ {stats.warning_count} urgent{stats.warning_count > 1 ? 's' : ''}
            </span>
          )}
          {stats.notice_count > 0 && (
            <span className="px-2 py-1 text-xs font-medium bg-warning/20 text-warning rounded-full">
              {stats.notice_count} attention
            </span>
          )}
        </div>
      </div>

      {/* Liste des alertes */}
      <div className="divide-y divide-gray-50">
        {displayAlerts.map((alert) => {
          const colors = LEVEL_COLORS[alert.level];
          return (
            <div
              key={alert.id}
              className={`p-3 ${colors.bg} hover:brightness-95 transition-all`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                      J-{alert.days_until}
                    </span>
                    <h4 className="text-sm font-semibold text-base-content truncate">
                      {alert.produit_nom}
                    </h4>
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-base-content/60">
                    <span className="flex items-center gap-1">
                      <Package className="size-3" />
                      {alert.quantity_remaining} unité{alert.quantity_remaining > 1 ? 's' : ''}
                    </span>
                    {alert.lot_numero && (
                      <span className="font-mono text-base-content/50">
                        Lot: {alert.lot_numero}
                      </span>
                    )}
                    {alert.fournisseur_nom && (
                      <span className="truncate">
                        {alert.fournisseur_nom}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-base-content">
                    {formatCurrencyLocal(alert.valeur_stock)}
                  </p>
                  <p className="text-xs text-base-content/50">
                    PA: {formatCurrencyLocal(alert.prix_achat)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer avec bouton expand */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-3 text-sm font-medium text-base-content/60 hover:text-base-content hover:bg-base-200 transition-colors flex items-center justify-center gap-1"
        >
          {expanded ? (
            <>
              <ChevronUp className="size-4" />
              {t('common:actions.show_less', { defaultValue: 'Voir moins' })}
            </>
          ) : (
            <>
              <ChevronDown className="size-4" />
              {t('common:actions.show_more', { defaultValue: `Voir ${alerts.length - 3} de plus` })}
            </>
          )}
        </button>
      )}

      {/* Lien rapide action */}
      <div className="p-3 bg-base-200 border-t border-base-200">
        <Link
          to="/app/perimes"
          className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-base-100 border border-base-300 rounded-xl text-sm font-medium text-base-content hover:bg-base-200 hover:border-base-300 transition-all"
        >
          <Clock className="size-4" />
          {t('expiration.manage_perimes', { defaultValue: 'Gérer les produits périmés' })}
        </Link>
      </div>
    </div>
  );
}
