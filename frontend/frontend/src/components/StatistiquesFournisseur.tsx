import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { getLocale } from '../utils/dateUtils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  useAnalyseFournisseurs,
  useComparaisonPrix,
  useRepartitionAchats
} from '../hooks/useFinanceStats';
import { useTranslation } from 'react-i18next';

interface StatsFournisseur {
  id: number;
  nom: string;
  ca_ttc: number;
  cout_achat: number;
  marge_brute: number;
  quantite_vendue: number;
}

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d',
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#6366F1', '#EC4899',
  '#8B5CF6', '#14B8A6', '#F97316', '#06B6D4', '#84CC16', '#D946EF'
];

export default function StatistiquesFournisseur() {
  const { t, i18n } = useTranslation(['supplier_stats', 'common']);
  const [activeTab, setActiveTab] = useState('ventes');

  // Helper pour formater les dates en YYYY-MM-DD local
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [stats, setStats] = useState<StatsFournisseur[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateDebut, setDateDebut] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1er du mois
    return formatDate(d);
  });
  const [dateFin, setDateFin] = useState(() => {
    return formatDate(new Date());
  });

  // Hooks pour les nouvelles analyses
  const { data: supplierAnalysis, isLoading: loadingAnalysis } = useAnalyseFournisseurs();
  const { data: prixComparaison, isLoading: loadingPrix } = useComparaisonPrix();
  const { data: repartitionAchats, isLoading: loadingRepartition } = useRepartitionAchats();


  const fetchStats = async () => {
    try {
      setLoading(true);

      const response = await api.get('statistiques/ca_par_fournisseur/', {
        params: {
          date_debut: dateDebut,
          date_fin: dateFin
        }
      });

      setStats(response.data);
    } catch (error) {
      console.error("Erreur lors du chargement des statistiques", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []); 

  // Totaux Ventes
  const totaux = useMemo(() => {
    return stats.reduce((acc, curr) => ({
      ca_ttc: acc.ca_ttc + Number(curr.ca_ttc),
      cout_achat: acc.cout_achat + Number(curr.cout_achat),
      marge_brute: acc.marge_brute + Number(curr.marge_brute),
      quantite_vendue: acc.quantite_vendue + curr.quantite_vendue
    }), { ca_ttc: 0, cout_achat: 0, marge_brute: 0, quantite_vendue: 0 });
  }, [stats]);

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-start">
        <div>
          <h1 className="text-2xl font-bold text-base-content">{t('title')}</h1>
          <p className="text-sm text-base-content/80">{t('subtitle')}</p>
        </div>
        
        {/* Date Filter only for Sales Tab currently */}
        {activeTab === 'ventes' && (
            <div className="flex flex-col sm:flex-row sm:items-end gap-2 bg-base-100 p-2 sm:p-3 rounded-lg shadow-sm border border-base-200 w-full md:w-auto">
            <div className="form-control w-full sm:w-40">
                <label className="label py-1"><span className="label-text text-xs">{t('filters.from')}</span></label>
                <input 
                type="date"
                lang={getLocale()}
                className="input input-bordered input-sm w-full" 
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                />
            </div>
            <div className="form-control w-full sm:w-40">
                <label className="label py-1"><span className="label-text text-xs">{t('filters.to')}</span></label>
                <input 
                type="date"
                lang={getLocale()}
                className="input input-bordered input-sm w-full" 
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                />
            </div>
            <button 
                className="btn btn-primary btn-sm w-full sm:w-auto h-10"
                onClick={fetchStats}
                disabled={loading}
            >
                {loading ? <span className="loading loading-spinner loading-xs"></span> : t('filters.refresh')}
            </button>
            </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="w-full max-w-full overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0">
        <div className="tabs tabs-boxed bg-base-100 p-1 w-max min-w-full sm:min-w-0 sm:w-fit">
        <a className={`tab whitespace-nowrap ${activeTab === 'ventes' ? 'tab-active' : ''}`} onClick={() => setActiveTab('ventes')}>{t('tabs.sales')}</a>
        <a className={`tab whitespace-nowrap ${activeTab === 'performance' ? 'tab-active' : ''}`} onClick={() => setActiveTab('performance')}>{t('tabs.performance')}</a>
        <a className={`tab whitespace-nowrap ${activeTab === 'prix' ? 'tab-active' : ''}`} onClick={() => setActiveTab('prix')}>{t('tabs.price_comparison')}</a>
        <a className={`tab whitespace-nowrap ${activeTab === 'concentration' ? 'tab-active' : ''}`} onClick={() => setActiveTab('concentration')}>{t('tabs.concentration')}</a>
        </div>
      </div>

      {/* TAB 1: VENTES (Existing Content) */}
      {activeTab === 'ventes' && (
        <div className="space-y-6 animate-fade-in">
           {/* Info Box */}
            <div className="alert alert-info shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div>
                <h3 className="font-bold">{t('sales_tab.calculation_method')}</h3>
                <div className="text-sm">
                    {t('sales_tab.info_text')}
                </div>
                </div>
            </div>

            {/* Cartes Résumé */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card bg-base-100 shadow-sm border border-base-200">
                <div className="card-body p-4">
                    <p className="text-sm font-medium text-base-content/70">{t('sales_tab.cards.total_ca')}</p>
                    <h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(Math.round(totaux.ca_ttc), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</h3>
                </div>
                </div>
                <div className="card bg-base-100 shadow-sm border border-base-200">
                <div className="card-body p-4">
                    <p className="text-sm font-medium text-base-content/70">{t('sales_tab.cards.purchase_cost')}</p>
                    <h3 className="text-2xl font-bold text-blue-600">{formatCurrency(Math.round(totaux.cout_achat), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</h3>
                </div>
                </div>
                <div className="card bg-base-100 shadow-sm border border-base-200">
                <div className="card-body p-4">
                    <p className="text-sm font-medium text-base-content/70">{t('sales_tab.cards.gross_margin')}</p>
                    <h3 className="text-2xl font-bold text-amber-600">{formatCurrency(Math.round(totaux.marge_brute), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</h3>
                    <p className="text-xs text-base-content/60">
                    {totaux.ca_ttc > 0 ? ((totaux.marge_brute / totaux.ca_ttc) * 100).toFixed(1) : 0} {t('sales_tab.cards.margin_percentage')}
                    </p>
                </div>
                </div>
                <div className="card bg-base-100 shadow-sm border border-base-200">
                <div className="card-body p-4">
                    <p className="text-sm font-medium text-base-content/70">{t('sales_tab.cards.units_sold')}</p>
                    <h3 className="text-2xl font-bold text-purple-600">{totaux.quantite_vendue}</h3>
                </div>
                </div>
            </div>

            {/* Graphique */}
            <div className="card bg-base-100 shadow-sm border border-base-200">
                <div className="card-body p-4">
                <h2 className="card-title text-lg font-bold mb-4">{t('sales_tab.chart.title')}</h2>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="nom" />
                        <YAxis />
                        <Tooltip formatter={(value) => `${formatCurrency(Number(value), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}`} />
                        <Legend />
                        <Bar dataKey="ca_ttc" name={t('sales_tab.chart.ca')} fill="#10b981" />
                        <Bar dataKey="marge_brute" name={t('sales_tab.chart.margin')} fill="#f59e0b" />
                    </BarChart>
                    </ResponsiveContainer>
                </div>
                </div>
            </div>

            {/* Tableau détaillé */}
            <div className="card bg-base-100 shadow-sm border border-base-200">
                <div className="card-body p-0">
                <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                    <thead>
                        <tr className="bg-base-200">
                        <th>{t('sales_tab.table.supplier')}</th>
                        <th className="text-right">{t('sales_tab.table.qty_sold')}</th>
                        <th className="text-right">{t('sales_tab.table.purchase_cost')}</th>
                        <th className="text-right">{t('sales_tab.table.ca_ttc')}</th>
                        <th className="text-right">{t('sales_tab.table.gross_margin')}</th>
                        <th className="text-right">{t('sales_tab.table.margin_percent')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="text-center py-8 text-base-content/50">
                            {t('sales_tab.table.no_data')}
                            </td>
                        </tr>
                        ) : (
                        stats.map((stat) => (
                            <tr key={stat.id}>
                            <td className="font-medium">{stat.nom}</td>
                            <td className="text-right">{stat.quantite_vendue}</td>
                             <td className="text-right">{formatCurrency(Math.round(Number(stat.cout_achat)), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</td>
                             <td className="text-right font-bold">{formatCurrency(Math.round(Number(stat.ca_ttc)), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</td>
                             <td className="text-right text-success">{formatCurrency(Math.round(Number(stat.marge_brute)), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</td>
                            <td className="text-right text-sm">
                                {Number(stat.ca_ttc) > 0 
                                ? ((Number(stat.marge_brute) / Number(stat.ca_ttc)) * 100).toFixed(1) 
                                : 0}%
                            </td>
                            </tr>
                        ))
                        )}
                    </tbody>
                    </table>
                </div>
                </div>
            </div>
        </div>
      )}

      {/* TAB 2: PERFORMANCE (Scoring) */}
      {activeTab === 'performance' && (
        <div className="space-y-6 animate-fade-in">
             <div className="alert alert-warning shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div>
                <h3 className="font-bold">{t('performance_tab.alert_title')}</h3>
                <div className="text-sm">{t('performance_tab.alert_text')}</div>
                </div>
            </div>
            
            {loadingAnalysis ? (
                 <div className="h-64 flex items-center justify-center">
                    <span className="loading loading-spinner loading-lg"></span>
                 </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                     {supplierAnalysis?.map((item) => (
                         <div key={item.id} className="card bg-base-100 shadow-sm border border-base-200">
                             <div className="card-body p-4">
                                 <div className="flex justify-between items-start">
                                     <div>
                                         <h3 className="text-xl font-bold">{item.nom}</h3>
                                         <div className="badge badge-lg mt-2 badge-outline">Score: {item.score_global}/100</div>
                                     </div>
                                     <div className={`radial-progress font-bold text-lg ${
                                        item.score_global >= 80 ? 'text-success' : 
                                        item.score_global >= 50 ? 'text-warning' : 'text-error'
                                    }`} style={{ "--value": item.score_global, "--size": "4rem" } as any}>
                                        {item.score_global}
                                    </div>
                                 </div>
                                 
                                 <div className="divider my-1"></div>

                                 <div className="grid grid-cols-3 gap-4 text-center">
                                     <div>
                                         <div className="text-xs uppercase font-bold text-base-content/50">{t('performance_tab.metrics.volume')}</div>
                                          <div className="font-bold text-lg">{formatCurrency(Math.round(item.details.volume.valeur ?? 0), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</div>
                                         <progress className="progress progress-primary w-full" value={item.details.volume.score} max="100"></progress>
                                     </div>
                                     <div>
                                         <div className="text-xs uppercase font-bold text-base-content/50">{t('performance_tab.metrics.quality')}</div>
                                         <div className="font-bold text-lg">{item.details.qualite.incidents} {t('performance_tab.metrics.incidents')}</div>
                                         <progress className={`progress w-full ${item.details.qualite.score > 80 ? 'progress-success' : 'progress-error'}`} value={item.details.qualite.score} max="100"></progress>
                                     </div>
                                     <div>
                                         <div className="text-xs uppercase font-bold text-base-content/50">{t('performance_tab.metrics.consistency')}</div>
                                         <div className="font-bold text-lg">{item.details.regularite.nb_livraisons} {t('performance_tab.metrics.deliveries')}</div>
                                         <progress className="progress progress-info w-full" value={item.details.regularite.score} max="100"></progress>
                                     </div>
                                 </div>
                             </div>
                         </div>
                     ))}
                </div>
            )}
        </div>
      )}

      {/* TAB 3: COMPARATEUR PRIX */}
      {activeTab === 'prix' && (
        <div className="space-y-6 animate-fade-in">
             <div className="alert alert-success shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                <h3 className="font-bold">{t('prices_tab.alert_title')}</h3>
                <div className="text-sm">{t('prices_tab.alert_text')}</div>
                </div>
            </div>

            {loadingPrix ? (
                <div className="h-64 flex items-center justify-center">
                    <span className="loading loading-spinner loading-lg"></span>
                 </div>
            ) : (
                <div className="overflow-x-auto card bg-base-100 shadow-sm border border-base-200">
                    <table className="table table-zebra w-full">
                        <thead>
                            <tr>
                                <th>{t('prices_tab.table.product')}</th>
                                <th>{t('prices_tab.table.max_gap')}</th>
                                <th>{t('prices_tab.table.offers')}</th>
                                <th>{t('prices_tab.table.best_price')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prixComparaison?.map((prod) => (
                                <tr key={prod.id}>
                                    <td className="font-bold max-w-xs truncate" title={prod.produit}>{prod.produit}</td>
                                    <td>
                                        <span className={`badge ${
                                            prod.ecart_pourcentage > 20 ? 'badge-error text-white' : 
                                            prod.ecart_pourcentage > 5 ? 'badge-warning' : 'badge-ghost'
                                        }`}>
                                            {prod.ecart_pourcentage}%
                                        </span>
                                    </td>
                                    <td className="space-y-1">
                                        {prod.offres.map((offre, idx) => (
                                            <div key={idx} className="flex justify-between text-xs w-64">
                                                <span>{offre.fournisseur}:</span>
                                                 <span className={offre.prix_moyen === prod.meilleur_prix ? 'font-bold text-success' : ''}>
                                                     {formatCurrency(Math.round(offre.prix_moyen), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}
                                                 </span>
                                             </div>
                                         ))}
                                     </td>
                                      <td className="font-bold text-success text-lg">
                                         {formatCurrency(Math.round(prod.meilleur_prix), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}
                                      </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      )}

      {/* TAB 4: CONCENTRATION */}
      {activeTab === 'concentration' && (
        <div className="space-y-6 animate-fade-in">
             <div className="card bg-base-100 shadow-sm border border-base-200">
                <div className="card-body">
                    <h2 className="card-title">{t('concentration_tab.title')}</h2>
                    
                    {loadingRepartition ? (
                        <div className="h-64 flex items-center justify-center">
                            <span className="loading loading-spinner loading-lg"></span>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                            <div className="h-80 w-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={repartitionAchats?.data}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {repartitionAchats?.data.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                         <Tooltip formatter={(value) => `${formatCurrency(Number(value), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            
                            <div className="flex-1">
                                <table className="table w-full">
                                    <thead>
                                        <tr>
                                            <th>{t('concentration_tab.table.color')}</th>
                                            <th>{t('concentration_tab.table.supplier')}</th>
                                            <th>{t('concentration_tab.table.market_share')}</th>
                                            <th>{t('concentration_tab.table.volume')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {repartitionAchats?.data.map((entry, index) => (
                                            <tr key={entry.id}>
                                                <td>
                                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                                </td>
                                                <td className="font-bold">{entry.nom}</td>
                                                <td>{entry.pourcentage}%</td>
                                                 <td>{formatCurrency(Math.round(entry.value), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
             </div>
        </div>
      )}

    </div>
  );
}
