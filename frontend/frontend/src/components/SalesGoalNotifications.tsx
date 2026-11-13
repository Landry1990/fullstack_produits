import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useManagerStats } from '../hooks/useDashboard';
import { formatCurrency } from '../utils/formatters';
import { Trophy, X, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

type Periode = 'jour' | 'semaine' | 'mois';

/**
 * Cartes de célébration quand le CA atteint un objectif du tableau de bord
 * manager (jour / semaine / mois) — réservé aux admins. Réutilise les données
 * `manager_stats` (React Query, rafraîchi toutes les 5 min, caché 60 s côté
 * backend) : aucun calcul supplémentaire.
 * La croix masque la carte pour la session ET la période courante (la clé
 * contient le début de période → la carte réapparaît au prochain jour/lundi/
 * 1er du mois). Le conteneur `fixed` est mutualisé dans Layout.
 */
export function SalesGoalNotifications() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = !!user?.is_superuser || user?.role === 'PHARMACIEN';
  const { data } = useManagerStats(isAuthenticated && !loading && isAdmin);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  // Clé unique par période courante — un objectif atteint ne félicite qu'une
  // fois par période, même après masquage puis nouveau poll.
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const periodKeys: Record<Periode, string> = {
    jour: iso(now),
    semaine: iso(monday),
    mois: iso(now).slice(0, 7),
  };

  if (!isAdmin) return null;

  const kpis = data?.kpis;
  const achieved = (['jour', 'semaine', 'mois'] as Periode[]).filter(p => {
    const kpi = kpis?.[p];
    return !!kpi && kpi.target > 0 && kpi.rate >= 100 && !dismissedKeys.has(`${p}-${periodKeys[p]}`);
  });
  if (achieved.length === 0) return null;

  const dismiss = (p: Periode) =>
    setDismissedKeys(prev => new Set(prev).add(`${p}-${periodKeys[p]}`));

  return (
    <>
      {achieved.length > 1 && (
        <button
          onClick={() => setCollapsed(c => !c)}
          className="pointer-events-auto self-end flex items-center gap-1.5 px-3 h-7 rounded-full bg-slate-800 text-white text-xs font-bold shadow-lg hover:bg-slate-700 transition-colors"
        >
          <Trophy className="size-3.5" />
          {t('dashboard:manager_dashboard.goal_popup.count', { count: achieved.length })}
          {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      )}
      {!collapsed && achieved.map(p => {
        const kpi = kpis?.[p];
        if (!kpi) return null;
        return (
          <div key={p} className="pointer-events-auto rounded-xl border-l-4 shadow-xl bg-white px-4 py-3 border-amber-500">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-amber-100 text-amber-600">
                <Trophy className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm leading-tight text-amber-700">
                  {t(`dashboard:manager_dashboard.goal_popup.title_${p}`)}
                </div>
                <div className="text-xs mt-1 text-slate-600">
                  {t('dashboard:manager_dashboard.goal_popup.body', {
                    actual: `${formatCurrency(Math.round(kpi.actual))} ${t('common:currency')}`,
                    rate: Math.round(kpi.rate),
                    target: `${formatCurrency(Math.round(kpi.target))} ${t('common:currency')}`,
                  })}
                </div>
                <div className="flex gap-2 mt-2.5">
                  <button
                    onClick={() => navigate('/app/manager-dashboard')}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors"
                  >
                    <ExternalLink className="size-3.5" /> {t('dashboard:manager_dashboard.goal_popup.open')}
                  </button>
                </div>
              </div>
              <button onClick={() => dismiss(p)} className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors">
                <X className="size-4" />
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
