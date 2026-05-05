import { useState, useCallback } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';
import { formatDate, getLocale } from '../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import { usePharmacySettings } from '../context/PharmacySettingsContext';
import { generateMonthlyReportPdf } from '../utils/print/reportPdf';

interface RapportData {
  mois: string;
  ca: {
    ca_ttc: number;
    ca_ht: number;
    nb_ventes: number;
    total_remises: number;
    part_assurance: number;
    part_client: number;
  };
  marge: {
    cout_achat: number;
    marge_brute: number;
    marge_pct: number;
  };
  encaissements: Array<{
    mode: string;
    mode_label: string;
    montant: number;
  }>;
  depots_total: number;
  coupons_total: number;
  ventes_credit: number;
  recouvrements_total: number;
  creances_a_percevoir: number;
  ca_par_tva: Array<{
    taux: number;
    ca_ht: number;
    montant_tva: number;
    ca_ttc: number;
  }>;
  achats_par_fournisseur: Array<{
    fournisseur_id: number;
    fournisseur_nom: string;
    montant_total: number;
    nb_commandes: number;
  }>;
  clients_professionnels: {
    ca_total: number;
    montant_paye: number;
    reste_a_payer: number;
    taux_recouvrement_pct: number;
    nb_factures: number;
    top_clients: Array<{
      client_id: number;
      client_nom: string;
      ca_total: number;
      montant_paye: number;
      reste_a_payer: number;
    }>;
  };
  unites_gratuites: {
    valeur_totale: number;
    quantite_totale: number;
    pct_du_ca: number;
    nb_produits_distincts: number;
    top_produits: Array<{
      produit_id: number;
      produit_nom: string;
      quantite_gratuite: number;
      valeur_totale: number;
    }>;
  };
  mouvements_caisse: {
    total_entrees: number;
    total_sorties: number;
    solde: number;
    liste: Array<{
        id: number;
        date: string;
        type: string;
        montant: number;
        motif: string;
        user: string;
    }>;
  };
};

type FilterMode = 'month' | 'range';
type RangePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'custom';

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPresetDates(preset: RangePreset): { debut: string; fin: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return { debut: toISODate(today), fin: toISODate(today) };
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { debut: toISODate(y), fin: toISODate(y) };
    }
    case 'this_week': {
      const day = today.getDay();
      const monday = new Date(today); monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      return { debut: toISODate(monday), fin: toISODate(today) };
    }
    case 'last_week': {
      const day = today.getDay();
      const thisMonday = new Date(today); thisMonday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
      const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday); lastSunday.setDate(thisMonday.getDate() - 1);
      return { debut: toISODate(lastMonday), fin: toISODate(lastSunday) };
    }
    default:
      return { debut: toISODate(today), fin: toISODate(today) };
  }
}


export default function RapportMensuel() {
  const { t, i18n } = useTranslation(['monthly_report', 'common', 'caisse']);

  // Mode de filtre
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [activePreset, setActivePreset] = useState<RangePreset | null>(null);

  // Mode mensuel
  const [mois, setMois] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Mode tranche de dates
  const [dateDebut, setDateDebut] = useState(() => toISODate(new Date()));
  const [dateFin, setDateFin] = useState(() => toISODate(new Date()));

  const [rapport, setRapport] = useState<RapportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [periodeLabel, setPeriodeLabel] = useState<string>('');
  
  const { settings } = usePharmacySettings();

  const applyPreset = useCallback((preset: RangePreset) => {
    if (preset !== 'custom') {
      const { debut, fin } = getPresetDates(preset);
      setDateDebut(debut);
      setDateFin(fin);
    }
    setActivePreset(preset);
  }, []);

  const fetchRapport = async () => {
    setLoading(true);
    try {
      let response;
      if (filterMode === 'month') {
        response = await api.get('rapports/rapport_mensuel/', {
          params: { mois }
        });
        setPeriodeLabel(mois);
      } else {
        response = await api.get('rapports/rapport_par_dates/', {
          params: { date_debut: dateDebut, date_fin: dateFin }
        });
        setPeriodeLabel(`${dateDebut} → ${dateFin}`);
      }
      setRapport(response.data);
    } catch (error) {
      console.error("Erreur lors du chargement du rapport", error);
      toast.error(t('messages.load_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-base-100 p-4 sm:p-6 rounded-lg shadow-sm border border-base-200 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-base-content">📊 {t('title')}</h1>
            <p className="text-sm text-base-content/70 mt-1">{t('subtitle')}</p>
            {periodeLabel && rapport && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('filters.current_period')}: {periodeLabel}
              </div>
            )}
          </div>

          {/* Actions: Générer + PDF */}
          <div className="flex items-center gap-2 shrink-0">
            <button 
              className="btn btn-primary btn-sm gap-2"
              onClick={fetchRapport}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  {t('filters.loading')}
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t('filters.generate')}
                </>
              )}
            </button>
            
            <button 
              className="btn btn-neutral btn-sm gap-2"
              onClick={async () => {
                if (!rapport) return;
                setPdfLoading(true);
                try {
                  await generateMonthlyReportPdf(rapport, settings, periodeLabel, t);
                  toast.success(t('messages.pdf_success', { defaultValue: 'PDF généré avec succès' }));
                } catch (error) {
                  console.error('Erreur génération PDF:', error);
                  toast.error(t('messages.download_error'));
                } finally {
                  setPdfLoading(false);
                }
              }}
              disabled={!rapport || pdfLoading}
              title={t('pdf.tooltip')}
            >
              {pdfLoading ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              {t('pdf.download')}
            </button>

            <button 
              className="btn btn-sm gap-2 text-[#229ED9] border-[#229ED9]/30 hover:bg-[#229ED9]/10 hover:border-[#229ED9] transition-all"
              onClick={async () => {
                if (!rapport) return;
                try {
                  await api.post('telegram/rapport-mensuel/', {
                    rapport,
                    periode: periodeLabel,
                  });
                  toast.success(t('common:telegram.send_success'), { icon: '📨' });
                } catch (err: any) {
                  const msg = err?.response?.data?.message || t('common:telegram.send_error');
                  toast.error(msg);
                }
              }}
              disabled={!rapport}
              title={t('common:telegram.send_report')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.67l-2.93-.918c-.638-.196-.65-.638.136-.943l11.434-4.41c.53-.194.995.131.822.943z"/>
              </svg>
              Telegram
            </button>
          </div>
        </div>

        {/* Tabs: Mois / Tranche de dates */}
        <div className="border-t border-base-200 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="tabs tabs-boxed bg-base-200/70 p-1">
              <button
                className={`tab tab-sm font-medium transition-all ${filterMode === 'month' ? 'tab-active !bg-primary !text-white' : 'hover:bg-base-300'}`}
                onClick={() => { setFilterMode('month'); setActivePreset(null); }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('filters.tab_month')}
              </button>
              <button
                className={`tab tab-sm font-medium transition-all ${filterMode === 'range' ? 'tab-active !bg-primary !text-white' : 'hover:bg-base-300'}`}
                onClick={() => { setFilterMode('range'); if (!activePreset) applyPreset('today'); }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                {t('filters.tab_range')}
              </button>
            </div>
          </div>

          {/* Contenu du filtre */}
          {filterMode === 'month' ? (
            <div className="flex items-end gap-3">
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs font-medium">{t('filters.month')}</span></label>
                <input 
                  type="month" 
                  className="input input-bordered input-sm w-48" 
                  value={mois}
                  onChange={(e) => setMois(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Préréglages rapides */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider mr-1">{t('filters.presets')}:</span>
                {(['today', 'yesterday', 'this_week', 'last_week', 'custom'] as RangePreset[]).map((preset) => (
                  <button
                    key={preset}
                    className={`btn btn-xs gap-1.5 transition-all ${
                      activePreset === preset 
                        ? 'btn-primary shadow-sm' 
                        : 'btn-ghost bg-base-200/50 hover:bg-base-300'
                    }`}
                    onClick={() => applyPreset(preset)}
                  >
                    {preset === 'today' && '📅'}
                    {preset === 'yesterday' && '⏪'}
                    {preset === 'this_week' && '📆'}
                    {preset === 'last_week' && '🗓️'}
                    {preset === 'custom' && '✏️'}
                    {t(`filters.preset_${preset}`)}
                  </button>
                ))}
              </div>

              {/* Sélecteurs de dates */}
              <div className="flex items-end gap-3">
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-xs font-medium">{t('filters.date_start')}</span></label>
                  <input 
                    type="date"
                    lang={getLocale()}
                    className="input input-bordered input-sm w-44" 
                    value={dateDebut}
                    onChange={(e) => { setDateDebut(e.target.value); setActivePreset('custom'); }}
                  />
                </div>
                <div className="flex items-center pb-2 text-base-content/30 font-bold">→</div>
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-xs font-medium">{t('filters.date_end')}</span></label>
                  <input 
                    type="date"
                    lang={getLocale()}
                    className="input input-bordered input-sm w-44" 
                    value={dateFin}
                    min={dateDebut}
                    onChange={(e) => { setDateFin(e.target.value); setActivePreset('custom'); }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {rapport && (
        <>
          {/* 1. KPIs Principaux */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="stat bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-lg shadow-lg">
              <div className="stat-title text-emerald-100 font-semibold">{t('kpis.ca_ttc')}</div>
              <div className="stat-value text-3xl text-white">{formatCurrency(Math.round(rapport.ca.ca_ttc))}</div>
              <div className="stat-desc text-emerald-100">{t('kpis.sales_count', { count: rapport.ca.nb_ventes })}</div>
            </div>

            <div className="stat bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg">
              <div className="stat-title text-blue-100 font-semibold">{t('kpis.ca_ht')}</div>
              <div className="stat-value text-3xl text-white">{formatCurrency(Math.round(rapport.ca.ca_ht))}</div>
            </div>

            <div className="stat bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-lg shadow-lg">
              <div className="stat-title text-rose-100 font-semibold">{t('kpis.total_discounts', 'Total Remises')}</div>
              <div className="stat-value text-3xl text-white">{formatCurrency(Math.round(rapport.ca.total_remises))}</div>
            </div>

            <div className="stat bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg shadow-lg">
              <div className="stat-title text-amber-100 font-semibold">{t('kpis.gross_margin')}</div>
              <div className="stat-value text-3xl text-white">{formatCurrency(Math.round(rapport.marge.marge_brute))}</div>
              <div className="stat-desc text-amber-100">{t('kpis.margin_info', { pct: rapport.marge.marge_pct.toFixed(1) })}</div>
            </div>

            <div className="stat bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg">
              <div className="stat-title text-purple-100 font-semibold">{t('kpis.purchase_cost')}</div>
              <div className="stat-value text-3xl text-white">{formatCurrency(Math.round(rapport.marge.cout_achat))}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2. Achats par Fournisseur */}
            <div className="card bg-base-100 shadow-lg border border-base-200">
              <div className="card-body">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {t('suppliers.title')}
                </h2>
                <div className="overflow-x-auto">
                  {rapport.achats_par_fournisseur.length > 0 ? (
                    <table className="table table-zebra w-full">
                      <thead>
                        <tr className="bg-base-200 text-base-content uppercase text-sm">
                          <th>{t('suppliers.name')}</th>
                          <th className="text-right">{t('suppliers.orders')}</th>
                          <th className="text-right">{t('suppliers.amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rapport.achats_par_fournisseur.map((f) => (
                          <tr key={f.fournisseur_id} className="hover">
                            <td className="font-medium">{f.fournisseur_nom}</td>
                            <td className="text-right">
                              <span className="badge badge-ghost font-bold">{f.nb_commandes}</span>
                            </td>
                            <td className="text-right font-bold text-primary">
                              {formatCurrency(Math.round(Number(f.montant_total)))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-base-200 font-bold text-base-content">
                        <tr>
                          <td className="uppercase text-sm">{t('suppliers.total')}</td>
                          <td className="text-right">
                            {rapport.achats_par_fournisseur.reduce((acc, f) => acc + f.nb_commandes, 0)}
                          </td>
                          <td className="text-right text-primary">
                            {formatCurrency(Math.round(rapport.achats_par_fournisseur.reduce((acc, f) => acc + Number(f.montant_total), 0)))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-base-content/50">
                      <p>{t('suppliers.no_data')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Clients Professionnels */}
            <div className="card bg-base-100 shadow-lg border border-base-200">
              <div className="card-body">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {t('pro_clients.title')}
                </h2>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-base-50 rounded-lg">
                    <div className="text-xs text-base-content/60 font-medium">{t('pro_clients.ca_total')}</div>
                    <div className="text-lg font-bold text-info">{formatCurrency(Math.round(rapport.clients_professionnels.ca_total))}</div>
                  </div>
                  <div className="text-center p-3 bg-success/10 rounded-lg">
                    <div className="text-xs text-success/70 font-medium">{t('pro_clients.paid')}</div>
                    <div className="text-lg font-bold text-success">{formatCurrency(Math.round(rapport.clients_professionnels.montant_paye))}</div>
                  </div>
                  <div className="text-center p-3 bg-warning/10 rounded-lg">
                    <div className="text-xs text-warning/70 font-medium">{t('pro_clients.balance')}</div>
                    <div className="text-lg font-bold text-warning">{formatCurrency(Math.round(rapport.clients_professionnels.reste_a_payer))}</div>
                  </div>
                  <div className="text-center p-3 bg-indigo-500/10 rounded-lg">
                    <div className="text-xs text-indigo-500/70 font-medium">{t('pro_clients.recoveries', 'Recouvrements')}</div>
                    <div className="text-lg font-bold text-indigo-600">{formatCurrency(Math.round(rapport.recouvrements_total))}</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{t('pro_clients.recovery_rate')}</span>
                    <span className="font-bold">{rapport.clients_professionnels.taux_recouvrement_pct.toFixed(1)}%</span>
                  </div>
                  <progress 
                    className="progress progress-success w-full" 
                    value={rapport.clients_professionnels.taux_recouvrement_pct} 
                    max="100"
                  ></progress>
               </div>

                {rapport.clients_professionnels.top_clients.length > 0 && (
                  <div className="overflow-x-auto">
                    <div className="text-xs font-semibold text-base-content/70 mb-2">{t('pro_clients.top_clients')}</div>
                    <table className="table table-zebra table-xs w-full">
                      <thead>
                        <tr className="bg-base-200">
                          <th>{t('free_units.product')}</th>
                          <th className="text-right">{t('tva.ht')}</th>
                          <th className="text-right">{t('pro_clients.balance')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rapport.clients_professionnels.top_clients.slice(0, 5).map((c) => (
                          <tr key={c.client_id} className="hover">
                            <td className="font-medium">{c.client_nom}</td>
                            <td className="text-right">{formatCurrency(Math.round(Number(c.ca_total)))}</td>
                            <td className="text-right text-warning font-bold">{formatCurrency(Math.round(Number(c.reste_a_payer)))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Unités Gratuites */}
            <div className="card bg-base-100 shadow-lg border border-base-200">
              <div className="card-body">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('free_units.title')}
                </h2>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 bg-success/10 rounded">
                    <div className="text-xs text-success/70">{t('free_units.value')}</div>
                    <div className="text-sm font-bold text-success">{formatCurrency(Math.round(rapport.unites_gratuites.valeur_totale))}</div>
                  </div>
                  <div className="text-center p-2 bg-base-50 rounded">
                    <div className="text-xs text-base-content/60">{t('free_units.quantity')}</div>
                    <div className="text-sm font-bold">{rapport.unites_gratuites.quantite_totale}</div>
                  </div>
                  <div className="text-center p-2 bg-base-50 rounded">
                    <div className="text-xs text-base-content/60">{t('free_units.ca_pct')}</div>
                    <div className="text-sm font-bold">{rapport.unites_gratuites.pct_du_ca.toFixed(1)}%</div>
                  </div>
                </div>

                {rapport.unites_gratuites.top_produits.length > 0 && (
                  <div className="overflow-x-auto">
                    <div className="text-xs font-semibold text-base-content/70 mb-2">{t('free_units.top_products')}</div>
                    <table className="table table-zebra table-xs w-full">
                      <thead>
                        <tr className="bg-base-200">
                          <th>{t('free_units.product')}</th>
                          <th className="text-right">{t('free_units.qty')}</th>
                          <th className="text-right">{t('free_units.value')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rapport.unites_gratuites.top_produits.slice(0, 5).map((p) => (
                          <tr key={p.produit_id} className="hover">
                            <td className="font-medium truncate max-w-xs" title={p.produit_nom}>{p.produit_nom}</td>
                            <td className="text-right">{p.quantite_gratuite}</td>
                            <td className="text-right font-bold">{formatCurrency(Math.round(Number(p.valeur_totale)))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Encaissements */}
            <div className="card bg-base-100 shadow-lg border border-base-200">
              <div className="card-body">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {t('encaissements.title')}
                </h2>
                <div className="overflow-x-auto">
                  {rapport.encaissements.length > 0 ? (
                    <table className="table table-zebra table-sm w-full">
                      <thead>
                        <tr className="bg-base-200">
                          <th>{t('encaissements.mode')}</th>
                          <th className="text-right">{t('encaissements.amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rapport.encaissements.map((enc, idx) => (
                          <tr key={idx} className="hover">
                            <td className="font-medium">{enc.mode_label}</td>
                            <td className="text-right font-bold">{formatCurrency(Math.round(Number(enc.montant)))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-base-200 font-bold text-base-content">
                        {Number(rapport.depots_total) > 0 && (
                          <tr className="text-info bg-info/5">
                            <td>{t('caisse:journal.modes.depot')}</td>
                            <td className="text-right">
                              {formatCurrency(Math.round(Number(rapport.depots_total)))}
                            </td>
                          </tr>
                        )}
                        <tr className="border-t-2 border-base-300">
                          <td>{t('encaissements.subtotal', 'Sous-total Encaissements')}</td>
                          <td className="text-right text-success">
                            {formatCurrency(Math.round(
                              rapport.encaissements.reduce((sum, e) => sum + Number(e.montant), 0) + 
                              Number(rapport.depots_total || 0)
                            ))}
                          </td>
                        </tr>

                        {(Number(rapport.ventes_credit) > 0 || Number(rapport.coupons_total) > 0 || Number(rapport.ca.part_assurance) > 0) && (
                          <>
                            <tr className="border-t border-base-300">
                                <td colSpan={2} className="text-[10px] text-base-content/40 pt-2 uppercase tracking-tighter">
                                    {t('encaissements.non_cash_items', 'Éléments hors encaissement')}
                                </td>
                            </tr>
                            {Number(rapport.ventes_credit) > 0 && (
                              <tr className="text-warning bg-warning/5">
                                  <td>{t('caisse:journal.modes.en_compte')}</td>
                                  <td className="text-right">
                                  {formatCurrency(Math.round(Number(rapport.ventes_credit)))}
                                  </td>
                              </tr>
                            )}
                            {Number(rapport.coupons_total) > 0 && (
                              <tr className="text-secondary bg-secondary/5">
                                  <td>{t('caisse:journal.modes.coupon')}</td>
                                  <td className="text-right">
                                  {formatCurrency(Math.round(Number(rapport.coupons_total)))}
                                  </td>
                              </tr>
                            )}
                            {Number(rapport.ca.part_assurance) > 0 && (
                              <tr className="text-accent bg-accent/5">
                                  <td>{t('common:insurance', 'Assurances / Tiers-Payant')}</td>
                                  <td className="text-right">
                                  {formatCurrency(Math.round(Number(rapport.ca.part_assurance)))}
                                  </td>
                              </tr>
                            )}
                            <tr className="border-t-2 border-double border-base-300 bg-base-300/30">
                              <td className="uppercase font-black text-xs text-base-content/60">{t('common:total_general', 'Chiffre d\'Affaires (Facturation)')}</td>
                              <td className="text-right text-lg">
                                {formatCurrency(Math.round(Number(rapport.ca.ca_ttc)))}
                              </td>
                            </tr>
                          </>
                        )}
                      </tfoot>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-base-content/50">
                      <p>{t('encaissements.no_data')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>


          {/* 6. Mouvements de Caisse Extra-Comptables */}
          <div className="card bg-base-100 shadow-lg border border-base-200">
            <div className="card-body">
              <h2 className="card-title text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('caisse_mvts.title')}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="stat bg-base-100 rounded-box border border-base-200 p-4">
                  <div className="stat-title text-sm">{t('caisse_mvts.in')}</div>
                  <div className="stat-value text-success text-lg">{formatCurrency(Math.round(rapport.mouvements_caisse?.total_entrees || 0))}</div>
                </div>
                <div className="stat bg-base-100 rounded-box border border-base-200 p-4">
                  <div className="stat-title text-sm">{t('caisse_mvts.out')}</div>
                  <div className="stat-value text-error text-lg">{formatCurrency(Math.round(rapport.mouvements_caisse?.total_sorties || 0))}</div>
                </div>
                <div className="stat bg-base-100 rounded-box border border-base-200 p-4">
                  <div className="stat-title text-sm">{t('caisse_mvts.balance')}</div>
                  <div className={`stat-value text-lg ${(rapport.mouvements_caisse?.solde || 0) >= 0 ? 'text-success' : 'text-error'}`}>
                    {(rapport.mouvements_caisse?.solde || 0) > 0 ? '+' : ''}{formatCurrency(Math.round(rapport.mouvements_caisse?.solde || 0))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                {rapport.mouvements_caisse?.liste && rapport.mouvements_caisse.liste.length > 0 ? (
                  <table className="table table-zebra table-sm w-full">
                    <thead>
                      <tr className="bg-base-200">
                        <th>{t('caisse_mvts.date')}</th>
                        <th>{t('caisse_mvts.type')}</th>
                        <th>{t('caisse_mvts.reason')}</th>
                        <th>{t('caisse_mvts.user')}</th>
                        <th className="text-right">{t('encaissements.amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rapport.mouvements_caisse.liste.map((mvt) => (
                        <tr key={mvt.id} className="hover">
                          <td>{formatDate(mvt.date)}</td>
                          <td>
                            <span className={`badge badge-sm ${mvt.type === 'ENTREE' ? 'badge-success badge-outline' : 'badge-error badge-outline'}`}>
                              {mvt.type === 'ENTREE' ? t('caisse:journal.modes.entry_caps') : t('caisse:journal.modes.exit_caps')}
                            </span>
                          </td>
                          <td className="font-medium">{mvt.motif}</td>
                          <td className="text-xs text-base-content/70">{mvt.user}</td>
                          <td className={`text-right font-bold ${mvt.type === 'ENTREE' ? 'text-success' : 'text-error'}`}>
                            {mvt.type === 'SORTIE' ? '-' : '+'}{formatCurrency(Math.round(Number(mvt.montant)))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-base-content/50 bg-base-50 rounded-lg border border-base-200 border-dashed">
                    <p>{t('caisse_mvts.no_data')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 7. CA par TVA + Créances */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card bg-base-100 shadow-lg border border-base-200">
              <div className="card-body">
                <h2 className="card-title text-lg">{t('tva.title')}</h2>
                <div className="overflow-x-auto">
                  <table className="table table-zebra table-sm w-full">
                    <thead>
                      <tr className="bg-base-200">
                        <th>{t('tva.rate')}</th>
                        <th className="text-right">{t('tva.ht')}</th>
                        <th className="text-right">{t('tva.tax')}</th>
                        <th className="text-right">{t('tva.ttc')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rapport.ca_par_tva.map((tva, idx) => (
                        <tr key={idx} className="hover">
                          <td className="font-medium">{tva.taux}%</td>
                           <td className="text-right">{formatCurrency(Math.round(Number(tva.ca_ht)))}</td>
                           <td className="text-right">{formatCurrency(Math.round(Number(tva.montant_tva)))}</td>
                           <td className="text-right font-bold">{formatCurrency(Math.round(Number(tva.ca_ttc)))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-lg border border-base-200">
              <div className="card-body">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('receivables.title')}
                </h2>
                <div className="flex items-center justify-center p-8 bg-warning/10 rounded-lg border border-warning/20">
                  <div className="text-center">
                    <div className="text-sm text-warning/70 font-medium mb-2">{t('receivables.total_to_recover')}</div>
                    <div className="text-4xl font-bold text-warning">
                      {formatCurrency(Math.round(Number(rapport.creances_a_percevoir || 0)))}
                    </div>
                    <div className="text-xs text-base-content/60 mt-2">{t('receivables.desc')}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!rapport && !loading && (
        <div className="flex flex-col items-center justify-center h-96 text-base-content/40">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-xl font-medium">{t('empty.title')}</p>
          <p className="text-sm mt-2">{t('empty.subtitle')}</p>
        </div>
      )}
    </div>
  );
}
