import { useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';
import { useTranslation } from 'react-i18next';

interface RapportData {
  mois: string;
  ca: {
    ca_ttc: number;
    ca_ht: number;
    nb_ventes: number;
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


export default function RapportMensuel() {
  const { t, i18n } = useTranslation(['translation', 'common', 'caisse']);
  const [mois, setMois] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [rapport, setRapport] = useState<RapportData | null>(null);
  const [loading, setLoading] = useState(false);

  const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''), []);

  const fetchRapport = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${apiBaseUrl}/api/rapports/rapport_mensuel/`, {
        params: { mois }
      });
      setRapport(response.data);
    } catch (error) {
      console.error("Erreur lors du chargement du rapport", error);
      toast.error(t('monthly_report.messages.load_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-lg shadow-sm border border-base-200">
        <div>
          <h1 className="text-3xl font-bold text-base-content">📊 {t('monthly_report.title')}</h1>
          <p className="text-sm text-base-content/70 mt-1">{t('monthly_report.subtitle')}</p>
        </div>
        
        <div className="flex items-end gap-2">
          <div className="form-control">
            <label className="label py-1"><span className="label-text text-xs font-medium">{t('monthly_report.filters.month')}</span></label>
            <input 
              type="month" 
              className="input input-bordered input-sm w-44" 
              value={mois}
              onChange={(e) => setMois(e.target.value)}
            />
          </div>
          <button 
            className="btn btn-primary btn-sm gap-2"
            onClick={fetchRapport}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                {t('monthly_report.filters.loading')}
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t('monthly_report.filters.generate')}
              </>
            )}
          </button>
          
          <button 
            className="btn btn-neutral btn-sm gap-2"
            onClick={async () => {
              try {
                const response = await axios.get(`${apiBaseUrl}/api/rapports/rapport_mensuel_pdf/`, {
                  params: { mois, lang: i18n.language },
                  responseType: 'blob'
                });
                // Créer un lien de téléchargement
                const url = window.URL.createObjectURL(new Blob([response.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `rapport_mensuel_${mois}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
              } catch (error) {
                console.error('Erreur téléchargement PDF:', error);
                toast.error(t('monthly_report.messages.download_error'));
              }
            }}
            disabled={!rapport}
            title={t('monthly_report.pdf.tooltip')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t('monthly_report.pdf.download')}
          </button>
        </div>
      </div>

      {rapport && (
        <>
          {/* 1. KPIs Principaux */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-lg shadow-lg">
              <div className="stat-title text-emerald-100 font-semibold">{t('monthly_report.kpis.ca_ttc')}</div>
              <div className="stat-value text-3xl">{formatCurrency(Math.round(rapport.ca.ca_ttc))} {t('common:currency')}</div>
              <div className="stat-desc text-emerald-100">{t('monthly_report.kpis.sales_count', { count: rapport.ca.nb_ventes })}</div>
            </div>

            <div className="stat bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg shadow-lg">
              <div className="stat-title text-blue-100 font-semibold">{t('monthly_report.kpis.ca_ht')}</div>
              <div className="stat-value text-3xl">{formatCurrency(Math.round(rapport.ca.ca_ht))} {t('common:currency')}</div>
            </div>

            <div className="stat bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-lg shadow-lg">
              <div className="stat-title text-amber-100 font-semibold">{t('monthly_report.kpis.gross_margin')}</div>
              <div className="stat-value text-3xl">{formatCurrency(Math.round(rapport.marge.marge_brute))} {t('common:currency')}</div>
              <div className="stat-desc text-amber-100">{t('monthly_report.kpis.margin_info', { pct: rapport.marge.marge_pct.toFixed(1) })}</div>
            </div>

            <div className="stat bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg shadow-lg">
              <div className="stat-title text-purple-100 font-semibold">{t('monthly_report.kpis.purchase_cost')}</div>
              <div className="stat-value text-3xl">{formatCurrency(Math.round(rapport.marge.cout_achat))} {t('common:currency')}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2. Achats par Fournisseur */}
            <div className="card bg-white shadow-lg border border-base-200">
              <div className="card-body">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {t('monthly_report.suppliers.title')}
                </h2>
                <div className="overflow-x-auto">
                  {rapport.achats_par_fournisseur.length > 0 ? (
                    <table className="table table-zebra w-full">
                      <thead>
                        <tr className="bg-base-200 text-base-content uppercase text-sm">
                          <th>{t('monthly_report.suppliers.name')}</th>
                          <th className="text-right">{t('monthly_report.suppliers.orders')}</th>
                          <th className="text-right">{t('monthly_report.suppliers.amount')}</th>
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
                              {formatCurrency(Math.round(Number(f.montant_total)))} {t('common:currency')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-base-200 font-bold text-base-content">
                        <tr>
                          <td className="uppercase text-sm">{t('monthly_report.suppliers.total')}</td>
                          <td className="text-right">
                            {rapport.achats_par_fournisseur.reduce((acc, f) => acc + f.nb_commandes, 0)}
                          </td>
                          <td className="text-right text-primary">
                            {formatCurrency(Math.round(rapport.achats_par_fournisseur.reduce((acc, f) => acc + Number(f.montant_total), 0)))} {t('common:currency')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-base-content/50">
                      <p>{t('monthly_report.suppliers.no_data')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Clients Professionnels */}
            <div className="card bg-white shadow-lg border border-base-200">
              <div className="card-body">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {t('monthly_report.pro_clients.title')}
                </h2>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-base-50 rounded-lg">
                    <div className="text-xs text-base-content/60 font-medium">{t('monthly_report.pro_clients.ca_total')}</div>
                    <div className="text-lg font-bold text-info">{formatCurrency(Math.round(rapport.clients_professionnels.ca_total))} {t('common:currency')}</div>
                  </div>
                  <div className="text-center p-3 bg-success/10 rounded-lg">
                    <div className="text-xs text-success/70 font-medium">{t('monthly_report.pro_clients.paid')}</div>
                    <div className="text-lg font-bold text-success">{formatCurrency(Math.round(rapport.clients_professionnels.montant_paye))} {t('common:currency')}</div>
                  </div>
                  <div className="text-center p-3 bg-warning/10 rounded-lg">
                    <div className="text-xs text-warning/70 font-medium">{t('monthly_report.pro_clients.balance')}</div>
                    <div className="text-lg font-bold text-warning">{formatCurrency(Math.round(rapport.clients_professionnels.reste_a_payer))} {t('common:currency')}</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{t('monthly_report.pro_clients.recovery_rate')}</span>
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
                    <div className="text-xs font-semibold text-base-content/70 mb-2">{t('monthly_report.pro_clients.top_clients')}</div>
                    <table className="table table-zebra table-xs w-full">
                      <thead>
                        <tr className="bg-base-200">
                          <th>{t('monthly_report.free_units.product')}</th>
                          <th className="text-right">{t('monthly_report.tva.ht')}</th>
                          <th className="text-right">{t('monthly_report.pro_clients.balance')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rapport.clients_professionnels.top_clients.slice(0, 5).map((c) => (
                          <tr key={c.client_id} className="hover">
                            <td className="font-medium">{c.client_nom}</td>
                            <td className="text-right">{formatCurrency(Math.round(Number(c.ca_total)))} {t('common:currency')}</td>
                            <td className="text-right text-warning font-bold">{formatCurrency(Math.round(Number(c.reste_a_payer)))} {t('common:currency')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Unités Gratuites */}
            <div className="card bg-white shadow-lg border border-base-200">
              <div className="card-body">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('monthly_report.free_units.title')}
                </h2>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 bg-success/10 rounded">
                    <div className="text-xs text-success/70">{t('monthly_report.free_units.value')}</div>
                    <div className="text-sm font-bold text-success">{formatCurrency(Math.round(rapport.unites_gratuites.valeur_totale))} {t('common:currency')}</div>
                  </div>
                  <div className="text-center p-2 bg-base-50 rounded">
                    <div className="text-xs text-base-content/60">{t('monthly_report.free_units.quantity')}</div>
                    <div className="text-sm font-bold">{rapport.unites_gratuites.quantite_totale}</div>
                  </div>
                  <div className="text-center p-2 bg-base-50 rounded">
                    <div className="text-xs text-base-content/60">{t('monthly_report.free_units.ca_pct')}</div>
                    <div className="text-sm font-bold">{rapport.unites_gratuites.pct_du_ca.toFixed(1)}%</div>
                  </div>
                </div>

                {rapport.unites_gratuites.top_produits.length > 0 && (
                  <div className="overflow-x-auto">
                    <div className="text-xs font-semibold text-base-content/70 mb-2">{t('monthly_report.free_units.top_products')}</div>
                    <table className="table table-zebra table-xs w-full">
                      <thead>
                        <tr className="bg-base-200">
                          <th>{t('monthly_report.free_units.product')}</th>
                          <th className="text-right">{t('monthly_report.free_units.qty')}</th>
                          <th className="text-right">{t('monthly_report.free_units.value')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rapport.unites_gratuites.top_produits.slice(0, 5).map((p) => (
                          <tr key={p.produit_id} className="hover">
                            <td className="font-medium truncate max-w-xs" title={p.produit_nom}>{p.produit_nom}</td>
                            <td className="text-right">{p.quantite_gratuite}</td>
                            <td className="text-right font-bold">{formatCurrency(Math.round(Number(p.valeur_totale)))} {t('common:currency')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Encaissements */}
            <div className="card bg-white shadow-lg border border-base-200">
              <div className="card-body">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {t('monthly_report.encaissements.title')}
                </h2>
                <div className="overflow-x-auto">
                  {rapport.encaissements.length > 0 ? (
                    <table className="table table-zebra table-sm w-full">
                      <thead>
                        <tr className="bg-base-200">
                          <th>{t('monthly_report.encaissements.mode')}</th>
                          <th className="text-right">{t('monthly_report.encaissements.amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rapport.encaissements.map((enc, idx) => (
                          <tr key={idx} className="hover">
                            <td className="font-medium">{enc.mode_label}</td>
                            <td className="text-right font-bold">{formatCurrency(Math.round(Number(enc.montant)))} {t('common:currency')}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-base-200 font-bold text-base-content">
                        <tr>
                          <td>{t('monthly_report.encaissements.total')}</td>
                          <td className="text-right text-success">
                            {formatCurrency(Math.round(rapport.encaissements.reduce((sum, e) => sum + Number(e.montant), 0)))} {t('common:currency')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-base-content/50">
                      <p>{t('monthly_report.encaissements.no_data')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 6. Mouvements de Caisse Extra-Comptables */}
          <div className="card bg-white shadow-lg border border-base-200">
            <div className="card-body">
              <h2 className="card-title text-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('monthly_report.caisse_mvts.title')}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="stat bg-base-100 rounded-box border border-base-200 p-4">
                  <div className="stat-title text-sm">{t('monthly_report.caisse_mvts.in')}</div>
                  <div className="stat-value text-success text-lg">{formatCurrency(Math.round(rapport.mouvements_caisse?.total_entrees || 0))} {t('common:currency')}</div>
                </div>
                <div className="stat bg-base-100 rounded-box border border-base-200 p-4">
                  <div className="stat-title text-sm">{t('monthly_report.caisse_mvts.out')}</div>
                  <div className="stat-value text-error text-lg">{formatCurrency(Math.round(rapport.mouvements_caisse?.total_sorties || 0))} {t('common:currency')}</div>
                </div>
                <div className="stat bg-base-100 rounded-box border border-base-200 p-4">
                  <div className="stat-title text-sm">{t('monthly_report.caisse_mvts.balance')}</div>
                  <div className={`stat-value text-lg ${(rapport.mouvements_caisse?.solde || 0) >= 0 ? 'text-success' : 'text-error'}`}>
                    {(rapport.mouvements_caisse?.solde || 0) > 0 ? '+' : ''}{formatCurrency(Math.round(rapport.mouvements_caisse?.solde || 0))} {t('common:currency')}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                {rapport.mouvements_caisse?.liste && rapport.mouvements_caisse.liste.length > 0 ? (
                  <table className="table table-zebra table-sm w-full">
                    <thead>
                      <tr className="bg-base-200">
                        <th>{t('monthly_report.caisse_mvts.date')}</th>
                        <th>{t('monthly_report.caisse_mvts.type')}</th>
                        <th>{t('monthly_report.caisse_mvts.reason')}</th>
                        <th>{t('monthly_report.caisse_mvts.user')}</th>
                        <th className="text-right">{t('monthly_report.encaissements.amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rapport.mouvements_caisse.liste.map((mvt) => (
                        <tr key={mvt.id} className="hover">
                          <td>{new Date(mvt.date).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US')}</td>
                          <td>
                            <span className={`badge badge-sm ${mvt.type === 'ENTREE' ? 'badge-success badge-outline' : 'badge-error badge-outline'}`}>
                              {mvt.type === 'ENTREE' ? t('caisse:journal.modes.entry_caps') : t('caisse:journal.modes.exit_caps')}
                            </span>
                          </td>
                          <td className="font-medium">{mvt.motif}</td>
                          <td className="text-xs text-base-content/70">{mvt.user}</td>
                          <td className={`text-right font-bold ${mvt.type === 'ENTREE' ? 'text-success' : 'text-error'}`}>
                            {mvt.type === 'SORTIE' ? '-' : '+'}{formatCurrency(Math.round(Number(mvt.montant)))} {t('common:currency')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-8 text-base-content/50 bg-base-50 rounded-lg border border-base-200 border-dashed">
                    <p>{t('monthly_report.caisse_mvts.no_data')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 7. CA par TVA + Créances */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card bg-white shadow-lg border border-base-200">
              <div className="card-body">
                <h2 className="card-title text-lg">{t('monthly_report.tva.title')}</h2>
                <div className="overflow-x-auto">
                  <table className="table table-zebra table-sm w-full">
                    <thead>
                      <tr className="bg-base-200">
                        <th>{t('monthly_report.tva.rate')}</th>
                        <th className="text-right">{t('monthly_report.tva.ht')}</th>
                        <th className="text-right">{t('monthly_report.tva.tax')}</th>
                        <th className="text-right">{t('monthly_report.tva.ttc')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rapport.ca_par_tva.map((tva, idx) => (
                        <tr key={idx} className="hover">
                          <td className="font-medium">{tva.taux}%</td>
                           <td className="text-right">{formatCurrency(Math.round(Number(tva.ca_ht)))} {t('common:currency')}</td>
                           <td className="text-right">{formatCurrency(Math.round(Number(tva.montant_tva)))} {t('common:currency')}</td>
                           <td className="text-right font-bold">{formatCurrency(Math.round(Number(tva.ca_ttc)))} {t('common:currency')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="card bg-white shadow-lg border border-base-200">
              <div className="card-body">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('monthly_report.receivables.title')}
                </h2>
                <div className="flex items-center justify-center p-8 bg-warning/10 rounded-lg border border-warning/20">
                  <div className="text-center">
                    <div className="text-sm text-warning/70 font-medium mb-2">{t('monthly_report.receivables.total_to_recover')}</div>
                    <div className="text-4xl font-bold text-warning">
                      {formatCurrency(Math.round(Number(rapport.creances_a_percevoir || 0)))} {t('common:currency')}
                    </div>
                    <div className="text-xs text-base-content/60 mt-2">{t('monthly_report.receivables.desc')}</div>
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
          <p className="text-xl font-medium">{t('monthly_report.empty.title')}</p>
          <p className="text-sm mt-2">{t('monthly_report.empty.subtitle')}</p>
        </div>
      )}
    </div>
  );
}
