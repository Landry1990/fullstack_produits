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
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">📊 {t('title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('subtitle')}</p>
            {periodeLabel && rapport && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-100">
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
              className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              onClick={fetchRapport}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
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
              className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-700 disabled:opacity-40 transition-colors"
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
                <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              {t('pdf.download')}
            </button>

            <button 
              className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-[#229ED9]/30 text-[#229ED9] text-xs font-bold hover:bg-[#229ED9]/10 hover:border-[#229ED9] disabled:opacity-40 transition-all"
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
        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button
                className={`inline-flex items-center h-8 px-4 rounded-lg text-xs font-bold transition-all ${
                  filterMode === 'month' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-200'
                }`}
                onClick={() => { setFilterMode('month'); setActivePreset(null); }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {t('filters.tab_month')}
              </button>
              <button
                className={`inline-flex items-center h-8 px-4 rounded-lg text-xs font-bold transition-all ${
                  filterMode === 'range' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-200'
                }`}
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
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('filters.month')}</label>
                <input 
                  type="month" 
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all w-48" 
                  value={mois}
                  onChange={(e) => setMois(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Préréglages rapides */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">{t('filters.presets')}:</span>
                {(['today', 'yesterday', 'this_week', 'last_week', 'custom'] as RangePreset[]).map((preset) => (
                  <button
                    key={preset}
                    className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-bold transition-all ${
                      activePreset === preset 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('filters.date_start')}</label>
                  <input 
                    type="date"
                    lang={getLocale()}
                    className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all w-44" 
                    value={dateDebut}
                    onChange={(e) => { setDateDebut(e.target.value); setActivePreset('custom'); }}
                  />
                </div>
                <div className="flex items-center pb-2 text-slate-300 font-bold">→</div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">{t('filters.date_end')}</label>
                  <input 
                    type="date"
                    lang={getLocale()}
                    className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all w-44" 
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
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl shadow-lg p-4">
              <div className="text-emerald-100 font-semibold text-xs uppercase tracking-widest mb-1">{t('kpis.ca_ttc')}</div>
              <div className="text-2xl font-black">{formatCurrency(Math.round(rapport.ca.ca_ttc))}</div>
              <div className="text-emerald-100 text-xs mt-1">{t('kpis.sales_count', { count: rapport.ca.nb_ventes })}</div>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl shadow-lg p-4">
              <div className="text-blue-100 font-semibold text-xs uppercase tracking-widest mb-1">{t('kpis.ca_ht')}</div>
              <div className="text-2xl font-black">{formatCurrency(Math.round(rapport.ca.ca_ht))}</div>
            </div>

            <div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-2xl shadow-lg p-4">
              <div className="text-rose-100 font-semibold text-xs uppercase tracking-widest mb-1">{t('kpis.total_discounts', 'Total Remises')}</div>
              <div className="text-2xl font-black">{formatCurrency(Math.round(rapport.ca.total_remises))}</div>
            </div>

            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-2xl shadow-lg p-4">
              <div className="text-amber-100 font-semibold text-xs uppercase tracking-widest mb-1">{t('kpis.gross_margin')}</div>
              <div className="text-2xl font-black">{formatCurrency(Math.round(rapport.marge.marge_brute))}</div>
              <div className="text-amber-100 text-xs mt-1">{t('kpis.margin_info', { pct: rapport.marge.marge_pct.toFixed(1) })}</div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl shadow-lg p-4">
              <div className="text-purple-100 font-semibold text-xs uppercase tracking-widest mb-1">{t('kpis.purchase_cost')}</div>
              <div className="text-2xl font-black">{formatCurrency(Math.round(rapport.marge.cout_achat))}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2. Achats par Fournisseur */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {t('suppliers.title')}
              </h2>
              <div className="overflow-x-auto">
                {rapport.achats_par_fournisseur.length > 0 ? (
                  <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="py-3 pl-4 text-left border-b border-slate-200">{t('suppliers.name')}</th>
                        <th className="py-3 text-right border-b border-slate-200">{t('suppliers.orders')}</th>
                        <th className="py-3 text-right border-b border-slate-200 pr-4">{t('suppliers.amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rapport.achats_par_fournisseur.map((f) => (
                        <tr key={f.fournisseur_id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 pl-4 font-medium text-slate-700">{f.fournisseur_nom}</td>
                          <td className="py-2.5 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">{f.nb_commandes}</span>
                          </td>
                          <td className="py-2.5 text-right font-bold text-blue-600 pr-4">
                            {formatCurrency(Math.round(Number(f.montant_total)))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold">
                      <tr className="border-t-2 border-slate-200">
                        <td className="py-2.5 pl-4 uppercase text-xs text-slate-500">{t('suppliers.total')}</td>
                        <td className="py-2.5 text-right text-slate-600">
                          {rapport.achats_par_fournisseur.reduce((acc, f) => acc + f.nb_commandes, 0)}
                        </td>
                        <td className="py-2.5 text-right text-blue-600 pr-4">
                          {formatCurrency(Math.round(rapport.achats_par_fournisseur.reduce((acc, f) => acc + Number(f.montant_total), 0)))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <p>{t('suppliers.no_data')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Clients Professionnels */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {t('pro_clients.title')}
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-xs text-slate-500 font-medium">{t('pro_clients.ca_total')}</div>
                  <div className="text-base font-bold text-cyan-600">{formatCurrency(Math.round(rapport.clients_professionnels.ca_total))}</div>
                </div>
                <div className="text-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="text-xs text-emerald-600 font-medium">{t('pro_clients.paid')}</div>
                  <div className="text-base font-bold text-emerald-600">{formatCurrency(Math.round(rapport.clients_professionnels.montant_paye))}</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="text-xs text-amber-600 font-medium">{t('pro_clients.balance')}</div>
                  <div className="text-base font-bold text-amber-600">{formatCurrency(Math.round(rapport.clients_professionnels.reste_a_payer))}</div>
                </div>
                <div className="text-center p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div className="text-xs text-indigo-500 font-medium">{t('pro_clients.recoveries', 'Recouvrements')}</div>
                  <div className="text-base font-bold text-indigo-600">{formatCurrency(Math.round(rapport.recouvrements_total))}</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-600">{t('pro_clients.recovery_rate')}</span>
                  <span className="font-bold text-slate-700">{rapport.clients_professionnels.taux_recouvrement_pct.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(rapport.clients_professionnels.taux_recouvrement_pct, 100)}%` }}
                  />
                </div>
              </div>

              {rapport.clients_professionnels.top_clients.length > 0 && (
                <div className="overflow-x-auto">
                  <div className="text-xs font-semibold text-slate-500 mb-2">{t('pro_clients.top_clients')}</div>
                  <table className="w-full border-separate border-spacing-0 text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="py-2 pl-3 text-left border-b border-slate-200">{t('free_units.product')}</th>
                        <th className="py-2 text-right border-b border-slate-200">{t('tva.ht')}</th>
                        <th className="py-2 text-right border-b border-slate-200 pr-3">{t('pro_clients.balance')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rapport.clients_professionnels.top_clients.slice(0, 5).map((c) => (
                        <tr key={c.client_id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-1.5 pl-3 font-medium text-slate-700">{c.client_nom}</td>
                          <td className="py-1.5 text-right text-slate-600">{formatCurrency(Math.round(Number(c.ca_total)))}</td>
                          <td className="py-1.5 text-right text-amber-600 font-bold pr-3">{formatCurrency(Math.round(Number(c.reste_a_payer)))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 4. Unités Gratuites */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('free_units.title')}
              </h2>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="text-xs text-emerald-600">{t('free_units.value')}</div>
                  <div className="text-sm font-bold text-emerald-600">{formatCurrency(Math.round(rapport.unites_gratuites.valeur_totale))}</div>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-xs text-slate-500">{t('free_units.quantity')}</div>
                  <div className="text-sm font-bold text-slate-700">{rapport.unites_gratuites.quantite_totale}</div>
                </div>
                <div className="text-center p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-xs text-slate-500">{t('free_units.ca_pct')}</div>
                  <div className="text-sm font-bold text-slate-700">{rapport.unites_gratuites.pct_du_ca.toFixed(1)}%</div>
                </div>
              </div>

              {rapport.unites_gratuites.top_produits.length > 0 && (
                <div className="overflow-x-auto">
                  <div className="text-xs font-semibold text-slate-500 mb-2">{t('free_units.top_products')}</div>
                  <table className="w-full border-separate border-spacing-0 text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="py-2 pl-3 text-left border-b border-slate-200">{t('free_units.product')}</th>
                        <th className="py-2 text-right border-b border-slate-200">{t('free_units.qty')}</th>
                        <th className="py-2 text-right border-b border-slate-200 pr-3">{t('free_units.value')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rapport.unites_gratuites.top_produits.slice(0, 5).map((p) => (
                        <tr key={p.produit_id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-1.5 pl-3 font-medium truncate max-w-xs text-slate-700" title={p.produit_nom}>{p.produit_nom}</td>
                          <td className="py-1.5 text-right text-slate-600">{p.quantite_gratuite}</td>
                          <td className="py-1.5 text-right font-bold text-slate-800 pr-3">{formatCurrency(Math.round(Number(p.valeur_totale)))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 5. Encaissements */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {t('encaissements.title')}
              </h2>
              <div className="overflow-x-auto">
                {rapport.encaissements.length > 0 ? (
                  <table className="w-full border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="py-3 pl-4 text-left border-b border-slate-200">{t('encaissements.mode')}</th>
                        <th className="py-3 text-right border-b border-slate-200 pr-4">{t('encaissements.amount')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rapport.encaissements.map((enc, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 pl-4 font-medium text-slate-700">{enc.mode_label}</td>
                          <td className="py-2.5 text-right font-bold text-slate-800 pr-4">{formatCurrency(Math.round(Number(enc.montant)))}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold">
                      {Number(rapport.depots_total) > 0 && (
                        <tr className="text-cyan-700">
                          <td className="py-2 pl-4">{t('caisse:journal.modes.depot')}</td>
                          <td className="py-2 text-right pr-4">
                            {formatCurrency(Math.round(Number(rapport.depots_total)))}
                          </td>
                        </tr>
                      )}
                      <tr className="border-t-2 border-slate-200">
                        <td className="py-2 pl-4 text-slate-600">{t('encaissements.subtotal', 'Sous-total Encaissements')}</td>
                        <td className="py-2 text-right text-emerald-600 pr-4">
                          {formatCurrency(Math.round(
                            rapport.encaissements.reduce((sum, e) => sum + Number(e.montant), 0) + 
                            Number(rapport.depots_total || 0)
                          ))}
                        </td>
                      </tr>

                      {(Number(rapport.ventes_credit) > 0 || Number(rapport.coupons_total) > 0 || Number(rapport.ca.part_assurance) > 0) && (
                        <>
                          <tr className="border-t border-slate-200">
                            <td colSpan={2} className="py-1 pl-4 text-[10px] text-slate-400 uppercase tracking-tighter">
                              {t('encaissements.non_cash_items', 'Eléments hors encaissement')}
                            </td>
                          </tr>
                          {Number(rapport.ventes_credit) > 0 && (
                            <tr className="text-amber-600">
                              <td className="py-1.5 pl-4">{t('caisse:journal.modes.en_compte')}</td>
                              <td className="py-1.5 text-right pr-4">
                                {formatCurrency(Math.round(Number(rapport.ventes_credit)))}
                              </td>
                            </tr>
                          )}
                          {Number(rapport.coupons_total) > 0 && (
                            <tr className="text-violet-600">
                              <td className="py-1.5 pl-4">{t('caisse:journal.modes.coupon')}</td>
                              <td className="py-1.5 text-right pr-4">
                                {formatCurrency(Math.round(Number(rapport.coupons_total)))}
                              </td>
                            </tr>
                          )}
                          {Number(rapport.ca.part_assurance) > 0 && (
                            <tr className="text-teal-600">
                              <td className="py-1.5 pl-4">{t('common:insurance', 'Assurances / Tiers-Payant')}</td>
                              <td className="py-1.5 text-right pr-4">
                                {formatCurrency(Math.round(Number(rapport.ca.part_assurance)))}
                              </td>
                            </tr>
                          )}
                          <tr className="border-t-2 border-double border-slate-300 bg-slate-100">
                            <td className="py-2.5 pl-4 uppercase font-black text-xs text-slate-500">{t('common:total_general', 'Chiffre d\'Affaires (Facturation)')}</td>
                            <td className="py-2.5 text-right text-lg font-bold text-slate-800 pr-4">
                              {formatCurrency(Math.round(Number(rapport.ca.ca_ttc)))}
                            </td>
                          </tr>
                        </>
                      )}
                    </tfoot>
                  </table>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <p>{t('encaissements.no_data')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>


          {/* 6. Mouvements de Caisse Extra-Comptables */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('caisse_mvts.title')}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">{t('caisse_mvts.in')}</div>
                <div className="text-lg font-black text-emerald-600">{formatCurrency(Math.round(rapport.mouvements_caisse?.total_entrees || 0))}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">{t('caisse_mvts.out')}</div>
                <div className="text-lg font-black text-red-500">{formatCurrency(Math.round(rapport.mouvements_caisse?.total_sorties || 0))}</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">{t('caisse_mvts.balance')}</div>
                <div className={`text-lg font-black ${
                  (rapport.mouvements_caisse?.solde || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {(rapport.mouvements_caisse?.solde || 0) > 0 ? '+' : ''}{formatCurrency(Math.round(rapport.mouvements_caisse?.solde || 0))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              {rapport.mouvements_caisse?.liste && rapport.mouvements_caisse.liste.length > 0 ? (
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="py-3 pl-4 text-left border-b border-slate-200">{t('caisse_mvts.date')}</th>
                      <th className="py-3 text-left border-b border-slate-200">{t('caisse_mvts.type')}</th>
                      <th className="py-3 text-left border-b border-slate-200">{t('caisse_mvts.reason')}</th>
                      <th className="py-3 text-left border-b border-slate-200">{t('caisse_mvts.user')}</th>
                      <th className="py-3 text-right border-b border-slate-200 pr-4">{t('encaissements.amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rapport.mouvements_caisse.liste.map((mvt) => (
                      <tr key={mvt.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 pl-4 text-slate-600">{formatDate(mvt.date)}</td>
                        <td className="py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
                            mvt.type === 'ENTREE'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {mvt.type === 'ENTREE' ? t('caisse:journal.modes.entry_caps') : t('caisse:journal.modes.exit_caps')}
                          </span>
                        </td>
                        <td className="py-2.5 font-medium text-slate-700">{mvt.motif}</td>
                        <td className="py-2.5 text-xs text-slate-400">{mvt.user}</td>
                        <td className={`py-2.5 text-right font-bold pr-4 ${
                          mvt.type === 'ENTREE' ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {mvt.type === 'SORTIE' ? '-' : '+'}{formatCurrency(Math.round(Number(mvt.montant)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p>{t('caisse_mvts.no_data')}</p>
                </div>
              )}
            </div>
          </div>

          {/* 7. CA par TVA + Créances */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-base font-bold text-slate-800 mb-4">{t('tva.title')}</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="py-3 pl-4 text-left border-b border-slate-200">{t('tva.rate')}</th>
                      <th className="py-3 text-right border-b border-slate-200">{t('tva.ht')}</th>
                      <th className="py-3 text-right border-b border-slate-200">{t('tva.tax')}</th>
                      <th className="py-3 text-right border-b border-slate-200 pr-4">{t('tva.ttc')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rapport.ca_par_tva.map((tva, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 pl-4 font-medium text-slate-700">{tva.taux}%</td>
                        <td className="py-2.5 text-right text-slate-600">{formatCurrency(Math.round(Number(tva.ca_ht)))}</td>
                        <td className="py-2.5 text-right text-slate-600">{formatCurrency(Math.round(Number(tva.montant_tva)))}</td>
                        <td className="py-2.5 text-right font-bold text-slate-800 pr-4">{formatCurrency(Math.round(Number(tva.ca_ttc)))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('receivables.title')}
              </h2>
              <div className="flex items-center justify-center p-8 bg-amber-50 rounded-xl border border-amber-100">
                <div className="text-center">
                  <div className="text-sm text-amber-600 font-medium mb-2">{t('receivables.total_to_recover')}</div>
                  <div className="text-4xl font-bold text-amber-600">
                    {formatCurrency(Math.round(Number(rapport.creances_a_percevoir || 0)))}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">{t('receivables.desc')}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!rapport && !loading && (
        <div className="flex flex-col items-center justify-center h-96 text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mb-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-xl font-medium">{t('empty.title')}</p>
          <p className="text-sm mt-2">{t('empty.subtitle')}</p>
        </div>
      )}
    </div>
  );
}
