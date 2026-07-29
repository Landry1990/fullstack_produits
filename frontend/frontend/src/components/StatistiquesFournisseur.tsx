import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../services/api';
import { Badge } from './ui/Badge';
import { formatCurrency } from '../utils/formatters';
import { getLocale } from '../utils/dateUtils';
import { useRecharts } from '../hooks/useRecharts';
import {
  useAnalyseFournisseurs,
  useComparaisonPrix,
  useRepartitionAchats
} from '../hooks/useFinanceStats';
import { useTranslation } from 'react-i18next';
import { Button } from './shadcn/button';
import { Card, CardContent, CardTitle } from './shadcn/card';
import { Progress } from './shadcn/progress';

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

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function StatistiquesFournisseur() {
  const { t, i18n } = useTranslation(['supplier_stats', 'common']);
  const [activeTab, setActiveTab] = useState('ventes');

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

  const Recharts = useRecharts();
  if (!Recharts) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400" /></div>;
  const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } = Recharts;

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
            <div className="flex flex-col gap-1 w-full sm:w-40">
                <label className="flex flex-col py-1"><span className="text-sm font-medium text-xs">{t('filters.from')}</span></label>
                <input 
                type="date"
                lang={getLocale()}
                className="w-full rounded-lg border border-base-300 bg-base-100 h-9 text-xs px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                />
            </div>
            <div className="flex flex-col gap-1 w-full sm:w-40">
                <label className="flex flex-col py-1"><span className="text-sm font-medium text-xs">{t('filters.to')}</span></label>
                <input 
                type="date"
                lang={getLocale()}
                className="w-full rounded-lg border border-base-300 bg-base-100 h-9 text-xs px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                />
            </div>
            <Button 
                variant="default" size="sm" className="w-full sm:w-auto h-10"
                onClick={fetchStats}
                disabled={loading}
            >
                {loading ? <Loader2 className="size-3 animate-spin" /> : t('filters.refresh')}
            </Button>
            </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="w-full max-w-full overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0">
        <div className="inline-flex bg-base-100 p-1 rounded-lg border border-base-200 gap-1 w-max min-w-full sm:min-w-0 sm:w-fit">
        <a className={`px-4 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-colors whitespace-nowrap ${activeTab === 'ventes' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-200'}`} onClick={() => setActiveTab('ventes')}>{t('tabs.sales')}</a>
        <a className={`px-4 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-colors whitespace-nowrap ${activeTab === 'performance' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-200'}`} onClick={() => setActiveTab('performance')}>{t('tabs.performance')}</a>
        <a className={`px-4 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-colors whitespace-nowrap ${activeTab === 'prix' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-200'}`} onClick={() => setActiveTab('prix')}>{t('tabs.price_comparison')}</a>
        <a className={`px-4 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-colors whitespace-nowrap ${activeTab === 'concentration' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-200'}`} onClick={() => setActiveTab('concentration')}>{t('tabs.concentration')}</a>
        </div>
      </div>

      {/* TAB 1: VENTES (Existing Content) */}
      {activeTab === 'ventes' && (
        <div className="space-y-6 animate-fade-in">
           {/* Info Box */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-sky-50 text-sky-800 dark:bg-sky-900/20 dark:text-sky-400 border border-sky-200 dark:border-sky-800 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 size-6">
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
                <Card className="bg-base-100 shadow-sm border border-base-200">
                <CardContent className="p-4">
                    <p className="text-sm font-medium text-base-content/70">{t('sales_tab.cards.total_ca')}</p>
                    <h3 className="text-2xl font-bold text-success">{formatCurrency(Math.round(totaux.ca_ttc), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</h3>
                </CardContent>
                </Card>
                <Card className="bg-base-100 shadow-sm border border-base-200">
                <CardContent className="p-4">
                    <p className="text-sm font-medium text-base-content/70">{t('sales_tab.cards.purchase_cost')}</p>
                    <h3 className="text-2xl font-bold text-primary">{formatCurrency(Math.round(totaux.cout_achat), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</h3>
                </CardContent>
                </Card>
                <Card className="bg-base-100 shadow-sm border border-base-200">
                <CardContent className="p-4">
                    <p className="text-sm font-medium text-base-content/70">{t('sales_tab.cards.gross_margin')}</p>
                    <h3 className="text-2xl font-bold text-warning">{formatCurrency(Math.round(totaux.marge_brute), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</h3>
                    <p className="text-xs text-base-content/60">
                    {totaux.ca_ttc > 0 ? ((totaux.marge_brute / totaux.ca_ttc) * 100).toFixed(1) : 0} {t('sales_tab.cards.margin_percentage')}
                    </p>
                </CardContent>
                </Card>
                <Card className="bg-base-100 shadow-sm border border-base-200">
                <CardContent className="p-4">
                    <p className="text-sm font-medium text-base-content/70">{t('sales_tab.cards.units_sold')}</p>
                    <h3 className="text-2xl font-bold text-purple-600">{totaux.quantite_vendue}</h3>
                </CardContent>
                </Card>
            </div>

            {/* Graphique */}
            <Card className="bg-base-100 shadow-sm border border-base-200">
                <CardContent className="p-4">
                <CardTitle className="text-lg font-bold mb-4">{t('sales_tab.chart.title')}</CardTitle>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="nom" />
                        <YAxis />
                        <Tooltip formatter={(value: number | string) => `${formatCurrency(Number(value), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}`} />
                        <Legend />
                        <Bar dataKey="ca_ttc" name={t('sales_tab.chart.ca')} fill="#10b981" />
                        <Bar dataKey="marge_brute" name={t('sales_tab.chart.margin')} fill="#f59e0b" />
                    </BarChart>
                    </ResponsiveContainer>
                </div>
                </CardContent>
            </Card>

            {/* Tableau détaillé */}
            <Card className="bg-base-100 shadow-sm border border-base-200">
                <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse [&>tbody>tr:nth-child(even)]:bg-base-200/50">
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
                </CardContent>
            </Card>
        </div>
      )}

      {/* TAB 2: PERFORMANCE (Scoring) */}
      {activeTab === 'performance' && (
        <div className="space-y-6 animate-fade-in">
             <div className="flex items-start gap-3 p-4 rounded-lg bg-[#fef3c7] text-[#78350f] dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div>
                <h3 className="font-bold">{t('performance_tab.alert_title')}</h3>
                <div className="text-sm">{t('performance_tab.alert_text')}</div>
                </div>
            </div>
            
            {loadingAnalysis ? (
                 <div className="h-64 flex items-center justify-center">
                    <Loader2 className="size-8 animate-spin" />
                 </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                     {supplierAnalysis?.map((item) => (
                         <Card key={item.id} className="bg-base-100 shadow-sm border border-base-200">
                             <CardContent className="p-4">
                                 <div className="flex justify-between items-start">
                                     <div>
                                         <h3 className="text-xl font-bold">{item.nom}</h3>
                                         <Badge variant="outline" size="lg" className="mt-2">Score: {item.score_global}/100</Badge>
                                     </div>
                                     <div className={`relative size-16 flex items-center justify-center font-bold text-lg ${
                                        item.score_global >= 80 ? 'text-success' :
                                        item.score_global >= 50 ? 'text-warning' : 'text-error'
                                    }`} style={{
                                        background: `conic-gradient(currentColor ${item.score_global * 3.6}deg, rgba(0,0,0,0.1) ${item.score_global * 3.6}deg)`,
                                        borderRadius: '50%',
                                    }}>
                                        <span className="bg-base-100 rounded-full size-12 flex items-center justify-center">
                                            {item.score_global}
                                        </span>
                                    </div>
                                 </div>
                                 
                                 <div className="border-t border-base-200 my-2"></div>

                                 <div className="grid grid-cols-3 gap-4 text-center">
                                     <div>
                                         <div className="text-xs uppercase font-bold text-base-content/50">{t('performance_tab.metrics.volume')}</div>
                                          <div className="font-bold text-lg">{formatCurrency(Math.round(item.details.volume.valeur ?? 0), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</div>
                                         <Progress value={item.details.volume.score} className="w-full" />
                                     </div>
                                     <div>
                                         <div className="text-xs uppercase font-bold text-base-content/50">{t('performance_tab.metrics.quality')}</div>
                                         <div className="font-bold text-lg">{item.details.qualite.incidents} {t('performance_tab.metrics.incidents')}</div>
                                         <Progress value={item.details.qualite.score} className={`w-full ${item.details.qualite.score > 80 ? '[&>div]:bg-emerald-500' : '[&>div]:bg-red-500'}`} />
                                     </div>
                                     <div>
                                         <div className="text-xs uppercase font-bold text-base-content/50">{t('performance_tab.metrics.consistency')}</div>
                                         <div className="font-bold text-lg">{item.details.regularite.nb_livraisons} {t('performance_tab.metrics.deliveries')}</div>
                                         <Progress value={item.details.regularite.score} className="w-full [&>div]:bg-sky-500" />
                                     </div>
                                 </div>
                             </CardContent>
                         </Card>
                     ))}
                </div>
            )}
        </div>
      )}

      {/* TAB 3: COMPARATEUR PRIX */}
      {activeTab === 'prix' && (
        <div className="space-y-6 animate-fade-in">
             <div className="flex items-start gap-3 p-4 rounded-lg bg-[#dcfce7] text-[#14532d] dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                <h3 className="font-bold">{t('prices_tab.alert_title')}</h3>
                <div className="text-sm">{t('prices_tab.alert_text')}</div>
                </div>
            </div>

            {loadingPrix ? (
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="size-8 animate-spin" />
                 </div>
            ) : (
                <Card className="bg-base-100 shadow-sm border border-base-200 overflow-x-auto">
                    <table className="w-full border-collapse [&>tbody>tr:nth-child(even)]:bg-base-200/50">
                        <thead>
                            <tr>
                                <th>{t('prices_tab.table.product')}</th>
                                <th>{t('prices_tab.table.max_gap')}</th>
                                <th>{t('prices_tab.table.offers')}</th>
                                <th>{t('prices_tab.table.best_price')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prixComparaison?.reduce<ReactNode[]>((rows, prod) => {
                                if (prod.ecart_pourcentage <= 0) return rows;
                                rows.push(
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
                                            {prod.offres.map((offre) => (
                                                <div key={offre.fournisseur} className="flex justify-between text-xs w-64">
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
                                );
                                return rows;
                            }, [])}
                        </tbody>
                    </table>
                </Card>
            )}
        </div>
      )}

      {/* TAB 4: CONCENTRATION */}
      {activeTab === 'concentration' && (
        <div className="space-y-6 animate-fade-in">
             <Card className="bg-base-100 shadow-sm border border-base-200">
                <CardContent>
                    <CardTitle>{t('concentration_tab.title')}</CardTitle>
                    
                    {loadingRepartition ? (
                        <div className="h-64 flex items-center justify-center">
                            <Loader2 className="size-8 animate-spin" />
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
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {repartitionAchats?.data.map((entry, index) => (
                                                <Cell key={entry.nom} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                         <Tooltip formatter={(value: number | string) => `${formatCurrency(Number(value), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            
                            <div className="flex-1">
                                <table className="w-full border-collapse">
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
                                                    <div className="size-4 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                                </td>
                                                <td className="font-bold">{entry.nom}</td>
                                                <td>{entry.pourcentage}%</td>
                                                 <td>{formatCurrency(Math.round(Number(entry.value)), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </CardContent>
             </Card>
        </div>
      )}

    </div>
  );
}
