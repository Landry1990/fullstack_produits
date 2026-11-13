import { useEffect, useCallback, useRef, useState } from 'react';
import { gooeyToast } from 'goey-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { treatmentReminderService, type TreatmentReminder, type DuePromis } from '../services/treatmentReminderService';
import promisService from '../services/promisService';
import { useAuth } from '../context/AuthContext';
import { Pill, Check, X, ExternalLink, ChevronDown, ChevronUp, Phone, PackageCheck } from 'lucide-react';
import { logger } from '../utils/logger';

/**
 * Panneau d'alertes « patient à informer » pour les admins (pharmacien/superuser).
 * Poll `/api/rappels-traitement/due/` toutes les 5 min et affiche des cartes
 * empilées en bas à droite — volontairement hors du système de toasts pour
 * ne pas se mélanger aux alertes (péremption, licence) et garder tout le
 * contenu visible. Deux sources :
 * - rappels de traitement (fin proche → commander ; arrivé → informer) ;
 * - promis passés PRET automatiquement à l'entrée en stock.
 * Les actions persistent en base ; la croix masque la carte jusqu'au reload.
 */
export function TreatmentReminderNotifications() {
  const { t } = useTranslation('rappels');
  const { isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = !!user?.is_superuser || user?.role === 'PHARMACIEN';
  const [rappels, setRappels] = useState<TreatmentReminder[]>([]);
  const [promis, setPromis] = useState<DuePromis[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await treatmentReminderService.getDue();
      setRappels(data.actif ? (data.rappels ?? []) : []);
      setPromis(data.actif ? (data.promis ?? []) : []);
    } catch (error) {
      logger.error('Erreur chargement rappels traitement:', error);
    }
  }, []);

  useEffect(() => {
    if (loading || !isAuthenticated || !isAdmin) return;
    load();
    intervalRef.current = setInterval(load, 5 * 60 * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isAuthenticated, loading, isAdmin, load]);

  const handleAction = useCallback(async (rappel: TreatmentReminder, action: 'traiter' | 'ignorer' | 'informer') => {
    try {
      if (action === 'traiter') await treatmentReminderService.traiter(rappel.id);
      else if (action === 'informer') await treatmentReminderService.patientInforme(rappel.id);
      else await treatmentReminderService.ignorer(rappel.id);
      setRappels(prev => prev.filter(r => r.id !== rappel.id));
      gooeyToast.success(t(`rappels:toasts.${action}`));
    } catch {
      gooeyToast.error(t('rappels:errors.action'));
    }
  }, [t]);

  const handlePromisInforme = useCallback(async (p: DuePromis) => {
    try {
      await promisService.clientInforme(p.id);
      setPromis(prev => prev.filter(x => x.id !== p.id));
      gooeyToast.success(t('rappels:toasts.informer'));
    } catch {
      gooeyToast.error(t('rappels:errors.action'));
    }
  }, [t]);

  const visible = rappels.filter(r => !dismissedIds.has(`r${r.id}`));
  const visiblePromis = promis.filter(p => !dismissedIds.has(`p${p.id}`));
  const total = visible.length + visiblePromis.length;
  if (!isAdmin || total === 0) return null;

  const dismiss = (key: string) => setDismissedIds(prev => new Set(prev).add(key));

  // Le conteneur `fixed bottom-4 right-4` est mutualisé dans Layout avec les
  // autres panneaux d'alerte (objectifs de vente) — ce composant ne rend que
  // des cartes.
  return (
    <>
      {/* En-tête du panneau quand plusieurs alertes */}
      {total > 1 && (
        <button
          onClick={() => setCollapsed(c => !c)}
          className="pointer-events-auto self-end flex items-center gap-1.5 px-3 h-7 rounded-full bg-slate-800 text-white text-xs font-bold shadow-lg hover:bg-slate-700 transition-colors"
        >
          <Pill className="size-3.5" />
          {t('rappels:popup.count', { count: total })}
          {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      )}
      {!collapsed && visiblePromis.map(p => (
        <div key={`p${p.id}`} className="pointer-events-auto rounded-xl border-l-4 shadow-xl bg-white px-4 py-3 border-blue-500">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-blue-100 text-blue-600">
              <PackageCheck className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm leading-tight text-blue-700">
                {t('rappels:popup.title_promis', { produit: p.produit_nom, count: p.quantite })}
              </div>
              <div className="text-xs mt-1 text-slate-600">
                {t('rappels:popup.body_inform', { client: p.client })}
              </div>
              {p.client_phone && (
                <a href={`tel:${p.client_phone}`} className="inline-flex items-center gap-1 text-xs mt-0.5 font-bold text-blue-700 hover:underline">
                  <Phone className="size-3" /> {p.client_phone}
                </a>
              )}
              <div className="flex gap-2 mt-2.5">
                <button onClick={() => handlePromisInforme(p)}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors">
                  <Phone className="size-3.5" /> {t('rappels:popup.informed')}
                </button>
                <button onClick={() => navigate('/app/promis')}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors">
                  <ExternalLink className="size-3.5" /> {t('rappels:popup.open')}
                </button>
              </div>
            </div>
            <button onClick={() => dismiss(`p${p.id}`)} className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors">
              <X className="size-4" />
            </button>
          </div>
        </div>
      ))}
      {!collapsed && visible.map(rappel => {
        const overdue = rappel.jours_restants < 0;
        const aInformer = rappel.statut === 'TRAITE';
        return (
          <div
            key={`r${rappel.id}`}
            className={`pointer-events-auto rounded-xl border-l-4 shadow-xl bg-white px-4 py-3 ${
              aInformer ? 'border-emerald-500' : overdue ? 'border-red-500' : 'border-amber-500'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 shrink-0 p-1.5 rounded-lg ${
                aInformer ? 'bg-emerald-100 text-emerald-600' : overdue ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
              }`}>
                {aInformer ? <Phone className="size-4" /> : <Pill className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-bold text-sm leading-tight ${
                  aInformer ? 'text-emerald-700' : overdue ? 'text-red-700' : 'text-amber-700'
                }`}>
                  {aInformer
                    ? t('rappels:popup.title_inform', { produit: rappel.produit_nom })
                    : overdue
                      ? t('rappels:popup.title_overdue', { jours: -rappel.jours_restants })
                      : t('rappels:popup.title', { jours: rappel.jours_restants })}
                </div>
                <div className="text-xs mt-1 text-slate-600">
                  {aInformer
                    ? t('rappels:popup.body_inform', { client: rappel.client_name })
                    : t('rappels:popup.body', { produit: rappel.produit_nom, client: rappel.client_name })}
                </div>
                {aInformer && rappel.client_phone && (
                  <a href={`tel:${rappel.client_phone}`} className="inline-flex items-center gap-1 text-xs mt-0.5 font-bold text-emerald-700 hover:underline">
                    <Phone className="size-3" /> {rappel.client_phone}
                  </a>
                )}
                {!aInformer && rappel.produit_stock !== null && (
                  <div className={`text-xs mt-0.5 font-bold ${rappel.produit_stock <= 0 ? 'text-red-600' : 'text-slate-500'}`}>
                    {t('rappels:popup.stock', { count: rappel.produit_stock })}
                  </div>
                )}
                <div className="flex gap-2 mt-2.5">
                  {aInformer ? (
                    <button onClick={() => handleAction(rappel, 'informer')}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
                      <Phone className="size-3.5" /> {t('rappels:popup.informed')}
                    </button>
                  ) : (
                    <button onClick={() => handleAction(rappel, 'traiter')}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
                      <Check className="size-3.5" /> {t('rappels:popup.done')}
                    </button>
                  )}
                  <button onClick={() => handleAction(rappel, 'ignorer')}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors">
                    <X className="size-3.5" /> {t('rappels:popup.ignore')}
                  </button>
                  <button onClick={() => navigate('/app/rappels-traitement')}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors">
                    <ExternalLink className="size-3.5" /> {t('rappels:popup.open')}
                  </button>
                </div>
              </div>
              <button
                onClick={() => dismiss(`r${rappel.id}`)}
                className="shrink-0 text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
