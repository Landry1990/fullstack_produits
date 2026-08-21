import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Download, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { Badge } from './ui/Badge';
import { formatCurrency } from '../utils/formatters';
import { getLocale, formatDate as formatDateDisplay } from '../utils/dateUtils';
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
import { Badge as ShadcnBadge } from './shadcn/badge';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/Table';
import { logger } from '../utils/logger'
import financeService from '../services/financeService';
import fournisseurService from '../services/fournisseurService';
import type { Fournisseur, PaiementFournisseur } from '../types';

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
      logger.error("Erreur lors du chargement des statistiques", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // ── TAB PAIEMENTS: Historique généralisé des paiements fournisseurs ──
  const [paiements, setPaiements] = useState<PaiementFournisseur[]>([]);
  const [paiementsCount, setPaiementsCount] = useState(0);
  const [loadingPaiements, setLoadingPaiements] = useState(false);
  const [exportingPaiements, setExportingPaiements] = useState(false);
  const [fournisseursList, setFournisseursList] = useState<Fournisseur[]>([]);
  const [paiementFournisseurFilter, setPaiementFournisseurFilter] = useState<string>('');
  const [paiementModeFilter, setPaiementModeFilter] = useState<string>('');
  const [paiementDateDebut, setPaiementDateDebut] = useState<string>('');
  const [paiementDateFin, setPaiementDateFin] = useState<string>('');
  const [paiementSearch, setPaiementSearch] = useState<string>('');
  const [paiementPage, setPaiementPage] = useState(1);
  const PAIEMENT_PAGE_SIZE = 20;

  useEffect(() => {
    fournisseurService.getAll({ page_size: 500 }).then((data) => {
      const list = Array.isArray(data) ? data : (data as { results?: Fournisseur[] })?.results || [];
      setFournisseursList(list);
    }).catch((error) => logger.error('Erreur lors du chargement des fournisseurs', error));
  }, []);

  const fetchPaiementsHistory = async () => {
    setLoadingPaiements(true);
    try {
      const data = await financeService.getPaiementsHistory({
        fournisseur: paiementFournisseurFilter ? Number(paiementFournisseurFilter) : undefined,
        mode_paiement: paiementModeFilter || undefined,
        date_debut: paiementDateDebut || undefined,
        date_fin: paiementDateFin || undefined,
        search: paiementSearch || undefined,
        page: paiementPage,
        page_size: PAIEMENT_PAGE_SIZE
      });
      setPaiements(data.results || []);
      setPaiementsCount(data.count || 0);
    } catch (error) {
      logger.error('Erreur lors du chargement des paiements fournisseurs', error);
    } finally {
      setLoadingPaiements(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'paiements') {
      fetchPaiementsHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, paiementFournisseurFilter, paiementModeFilter, paiementDateDebut, paiementDateFin, paiementPage]);

  const handlePaiementSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPaiementPage(1);
    fetchPaiementsHistory();
  };

  const resetPaiementFilters = () => {
    setPaiementFournisseurFilter('');
    setPaiementModeFilter('');
    setPaiementDateDebut('');
    setPaiementDateFin('');
    setPaiementSearch('');
    setPaiementPage(1);
  };

  const handleExportExcel = async () => {
    setExportingPaiements(true);
    try {
      const all = await financeService.getPaiementsHistoryAll({
        fournisseur: paiementFournisseurFilter ? Number(paiementFournisseurFilter) : undefined,
        mode_paiement: paiementModeFilter || undefined,
        date_debut: paiementDateDebut || undefined,
        date_fin: paiementDateFin || undefined,
        search: paiementSearch || undefined,
        ordering: '-date_paiement'
      });
      const rows = all.map((p) => ({
        [t('payments_tab.export.headers.date')]: formatDateDisplay(p.date_paiement),
        [t('payments_tab.export.headers.supplier')]: p.fournisseur_name,
        [t('payments_tab.export.headers.amount')]: Number(p.montant),
        [t('payments_tab.export.headers.mode')]: t(`payments_tab.modes.${p.mode_paiement}`),
        [t('payments_tab.export.headers.reference')]: p.reference || '',
        [t('payments_tab.export.headers.invoices')]: p.commandes_liees && p.commandes_liees.length > 0
          ? p.commandes_liees.join(', ')
          : (p.commande_numero || ''),
        [t('payments_tab.export.headers.created_by')]: p.created_by_name || '',
        [t('payments_tab.export.headers.notes')]: p.notes || ''
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, t('payments_tab.export.sheet_name'));
      const filename = `${t('payments_tab.export.filename')}_${formatDate(new Date())}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (error) {
      logger.error('Erreur lors de l\'export Excel des paiements', error);
    } finally {
      setExportingPaiements(false);
    }
  };

  const paiementsTotalMontant = useMemo(() => {
    return paiements.reduce((acc, p) => acc + Number(p.montant), 0);
  }, [paiements]);

  const paiementTotalPages = Math.max(1, Math.ceil(paiementsCount / PAIEMENT_PAGE_SIZE));

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
        <a className={`px-4 py-1.5 text-sm font-medium rounded-md cursor-pointer transition-colors whitespace-nowrap ${activeTab === 'paiements' ? 'bg-primary text-primary-content' : 'text-base-content/60 hover:bg-base-200'}`} onClick={() => setActiveTab('paiements')}>{t('tabs.payments')}</a>
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
                <Table className="table-fixed">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[25%] px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('sales_tab.table.supplier')}</TableHead>
                            <TableHead className="w-24 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('sales_tab.table.qty_sold')}</TableHead>
                            <TableHead className="w-32 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('sales_tab.table.purchase_cost')}</TableHead>
                            <TableHead className="w-32 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('sales_tab.table.ca_ttc')}</TableHead>
                            <TableHead className="w-32 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('sales_tab.table.gross_margin')}</TableHead>
                            <TableHead className="w-24 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('sales_tab.table.margin_percent')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {stats.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="px-3 py-8 text-center">
                                    {t('sales_tab.table.no_data')}
                                </TableCell>
                            </TableRow>
                        ) : (
                            stats.map((stat) => (
                                <TableRow key={stat.id}>
                                    <TableCell className="px-3 py-2 font-medium">{stat.nom}</TableCell>
                                    <TableCell className="px-3 py-2 text-right">{stat.quantite_vendue}</TableCell>
                                    <TableCell className="px-3 py-2 text-right">{formatCurrency(Math.round(Number(stat.cout_achat)), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</TableCell>
                                    <TableCell className="px-3 py-2 text-right font-bold">{formatCurrency(Math.round(Number(stat.ca_ttc)), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</TableCell>
                                    <TableCell className="px-3 py-2 text-right text-success">{formatCurrency(Math.round(Number(stat.marge_brute)), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</TableCell>
                                    <TableCell className="px-3 py-2 text-right text-sm">
                                        {Number(stat.ca_ttc) > 0
                                            ? ((Number(stat.marge_brute) / Number(stat.ca_ttc)) * 100).toFixed(1)
                                            : 0}%
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
      )}

      {/* TAB 2: PERFORMANCE (Scoring) */}
      {activeTab === 'performance' && (
        <div className="space-y-6 animate-fade-in">
          <Card className="border-amber-200/60 bg-amber-50/50 dark:bg-amber-900/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 text-amber-900 dark:text-amber-400">
                <AlertTriangle className="shrink-0 size-5 mt-0.5" />
                <div>
                  <CardTitle className="text-base font-bold">{t('performance_tab.alert_title')}</CardTitle>
                  <p className="text-sm text-amber-800/80 dark:text-amber-400/80 mt-1">{t('performance_tab.alert_text')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {loadingAnalysis ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="size-8 animate-spin text-slate-400" />
            </div>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('concentration_tab.table.supplier')}</TableHead>
                      <TableHead className="w-24 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('performance_tab.score')}</TableHead>
                      <TableHead className="w-24 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('performance_tab.metrics.volume')}</TableHead>
                      <TableHead className="w-24 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('performance_tab.metrics.quality')}</TableHead>
                      <TableHead className="w-24 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('performance_tab.metrics.consistency')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!supplierAnalysis?.length ? (
                      <TableRow>
                        <TableCell colSpan={5} className="px-3 py-8 text-center text-slate-500">
                          {t('performance_tab.no_data', { defaultValue: 'Aucune analyse disponible' })}
                        </TableCell>
                      </TableRow>
                    ) : (
                      supplierAnalysis.map((item) => {
                        const scoreColor = item.score_global >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                          item.score_global >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="px-3 py-2 font-medium text-slate-900">{item.nom}</TableCell>
                            <TableCell className="px-3 py-2 text-center">
                              <ShadcnBadge className={scoreColor}>
                                {item.score_global}/100
                              </ShadcnBadge>
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <div className="font-semibold text-sm text-slate-700">
                                {formatCurrency(Math.round(item.details.volume.valeur ?? 0), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}
                              </div>
                              <Progress value={item.details.volume.score} className="mt-2 [&>div]:bg-emerald-500" />
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <div className="font-semibold text-sm text-slate-700">
                                {item.details.qualite.incidents ?? 0} {t('performance_tab.metrics.incidents')}
                              </div>
                              <Progress value={item.details.qualite.score} className={`mt-2 [&>div]:${item.details.qualite.score > 80 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <div className="font-semibold text-sm text-slate-700">
                                {item.details.regularite.nb_livraisons ?? 0} {t('performance_tab.metrics.deliveries')}
                              </div>
                              <Progress value={item.details.regularite.score} className="mt-2 [&>div]:bg-sky-500" />
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
                <Card className="bg-base-100 shadow-sm border border-base-200">
                    <Table className="table-fixed">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[25%] px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('prices_tab.table.product')}</TableHead>
                                <TableHead className="w-24 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('prices_tab.table.max_gap')}</TableHead>
                                <TableHead className="w-[40%] px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('prices_tab.table.offers')}</TableHead>
                                <TableHead className="w-32 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('prices_tab.table.best_price')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {prixComparaison?.reduce<ReactNode[]>((rows, prod) => {
                                if (prod.ecart_pourcentage <= 0) return rows;
                                rows.push(
                                    <TableRow key={prod.id}>
                                        <TableCell className="px-3 py-2 font-medium max-w-xs truncate" title={prod.produit}>{prod.produit}</TableCell>
                                        <TableCell className="px-3 py-2 text-center">
                                            <Badge variant={
                                                prod.ecart_pourcentage > 20 ? 'error' :
                                                prod.ecart_pourcentage > 5 ? 'warning' : 'ghost'
                                            }>
                                                {prod.ecart_pourcentage}%
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-3 py-2 align-top">
                                            {prod.offres.map((offre) => (
                                                <div key={offre.fournisseur} className="flex justify-between text-xs w-full py-0.5">
                                                    <span className="truncate pr-2">{offre.fournisseur}</span>
                                                    <span className={offre.prix_moyen === prod.meilleur_prix ? 'font-bold text-success whitespace-nowrap' : 'whitespace-nowrap'}>
                                                        {formatCurrency(Math.round(offre.prix_moyen), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}
                                                    </span>
                                                </div>
                                            ))}
                                        </TableCell>
                                        <TableCell className="px-3 py-2 font-bold text-success text-lg text-right">
                                            {formatCurrency(Math.round(prod.meilleur_prix), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}
                                        </TableCell>
                                    </TableRow>
                                );
                                return rows;
                            }, [])}
                        </TableBody>
                    </Table>
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
                                <Table className="table-fixed">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('concentration_tab.table.color')}</TableHead>
                                            <TableHead className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('concentration_tab.table.supplier')}</TableHead>
                                            <TableHead className="w-44 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right pr-8">{t('concentration_tab.table.market_share')}</TableHead>
                                            <TableHead className="w-48 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right pl-8">{t('concentration_tab.table.volume')}</TableHead>
                                            <TableHead className="w-40 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right pl-8">{t('concentration_tab.table.quantity')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {repartitionAchats?.data.map((entry, index) => (
                                            <TableRow key={entry.id}>
                                                <TableCell className="px-3 py-2 text-center">
                                                    <div className="mx-auto size-4 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                </TableCell>
                                                <TableCell className="px-3 py-2 font-medium">{entry.nom}</TableCell>
                                                <TableCell className="px-3 py-2 text-right pr-8">{entry.pourcentage}%</TableCell>
                                                <TableCell className="px-3 py-2 text-right pl-8">{formatCurrency(Math.round(Number(entry.value)), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</TableCell>
                                                <TableCell className="px-3 py-2 text-right pl-8">{entry.quantite.toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'en-GB')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </CardContent>
             </Card>
        </div>
      )}

      {/* TAB 5: PAIEMENTS FOURNISSEURS (Historique généralisé) */}
      {activeTab === 'paiements' && (
        <div className="space-y-6 animate-fade-in">
          {/* Filtres */}
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-4">
              <form onSubmit={handlePaiementSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                <Select
                  label={t('payments_tab.filters.supplier')}
                  size="sm"
                  value={paiementFournisseurFilter}
                  onChange={(e) => { setPaiementFournisseurFilter(e.target.value); setPaiementPage(1); }}
                >
                  <option value="">{t('payments_tab.filters.all_suppliers')}</option>
                  {fournisseursList.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </Select>
                <Select
                  label={t('payments_tab.filters.mode')}
                  size="sm"
                  value={paiementModeFilter}
                  onChange={(e) => { setPaiementModeFilter(e.target.value); setPaiementPage(1); }}
                >
                  <option value="">{t('payments_tab.filters.all_modes')}</option>
                  <option value="ESP">{t('payments_tab.modes.ESP')}</option>
                  <option value="CHQ">{t('payments_tab.modes.CHQ')}</option>
                  <option value="VIR">{t('payments_tab.modes.VIR')}</option>
                  <option value="AVOIR">{t('payments_tab.modes.AVOIR')}</option>
                  <option value="AUTRE">{t('payments_tab.modes.AUTRE')}</option>
                </Select>
                <Input
                  label={t('payments_tab.filters.from')}
                  type="date"
                  size="sm"
                  lang={getLocale()}
                  value={paiementDateDebut}
                  onChange={(e) => { setPaiementDateDebut(e.target.value); setPaiementPage(1); }}
                />
                <Input
                  label={t('payments_tab.filters.to')}
                  type="date"
                  size="sm"
                  lang={getLocale()}
                  value={paiementDateFin}
                  onChange={(e) => { setPaiementDateFin(e.target.value); setPaiementPage(1); }}
                />
                <Input
                  label={t('payments_tab.filters.search')}
                  type="search"
                  size="sm"
                  value={paiementSearch}
                  onChange={(e) => setPaiementSearch(e.target.value)}
                  placeholder={t('payments_tab.filters.search')}
                />
                <div className="flex gap-2">
                  <Button type="submit" variant="default" size="sm" className="h-9 flex-1" disabled={loadingPaiements || exportingPaiements}>
                    {loadingPaiements ? <Loader2 className="size-3 animate-spin" /> : t('filters.refresh')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-9" onClick={resetPaiementFilters} disabled={exportingPaiements}>
                    {t('payments_tab.filters.reset')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-9" onClick={handleExportExcel} disabled={exportingPaiements}>
                    {exportingPaiements ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                    {t('payments_tab.export.button')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Cartes Résumé (page courante) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="shadow-sm border border-slate-200">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-slate-500">{t('payments_tab.cards.total_paid')}</p>
                <h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(Math.round(paiementsTotalMontant), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</h3>
              </CardContent>
            </Card>
            <Card className="shadow-sm border border-slate-200">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-slate-500">{t('payments_tab.cards.payments_count')}</p>
                <h3 className="text-2xl font-bold text-indigo-600">{paiementsCount}</h3>
              </CardContent>
            </Card>
          </div>

          {/* Tableau */}
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-0">
              <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('payments_tab.table.date')}</TableHead>
                      <TableHead className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('payments_tab.table.supplier')}</TableHead>
                      <TableHead className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('payments_tab.table.amount')}</TableHead>
                      <TableHead className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('payments_tab.table.mode')}</TableHead>
                      <TableHead className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('payments_tab.table.reference')}</TableHead>
                      <TableHead className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('payments_tab.table.linked_invoices')}</TableHead>
                      <TableHead className="px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('payments_tab.table.created_by')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingPaiements ? (
                      <TableRow>
                        <TableCell colSpan={7} className="px-3 py-8 text-center">
                          <Loader2 className="size-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : paiements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="px-3 py-8 text-center text-slate-500">
                          {t('payments_tab.table.no_data')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paiements.map((p) => (
                        <TableRow key={p.id} title={p.notes || undefined}>
                          <TableCell className="px-3 py-2 whitespace-nowrap text-slate-700">{formatDateDisplay(p.date_paiement)}</TableCell>
                          <TableCell className="px-3 py-2 font-medium text-slate-900">{p.fournisseur_name}</TableCell>
                          <TableCell className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(Math.round(Number(p.montant)), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</TableCell>
                          <TableCell className="px-3 py-2"><Badge variant="outline" size="sm">{t(`payments_tab.modes.${p.mode_paiement}`)}</Badge></TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-600">{p.reference || '-'}</TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-600 max-w-xs truncate">
                            {p.commandes_liees && p.commandes_liees.length > 0
                              ? p.commandes_liees.join(', ')
                              : (p.commande_numero || '-')}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-xs text-slate-600">{p.created_by_name || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

              {/* Pagination */}
              {paiementsCount > PAIEMENT_PAGE_SIZE && (
                <div className="flex items-center justify-between p-3 border-t border-slate-200">
                  <Button
                    variant="outline" size="sm"
                    disabled={paiementPage <= 1 || loadingPaiements}
                    onClick={() => setPaiementPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="size-4" /> {t('payments_tab.pagination.previous')}
                  </Button>
                  <span className="text-xs font-medium text-slate-600">
                    {t('payments_tab.pagination.page', { page: paiementPage, total: paiementTotalPages })}
                  </span>
                  <Button
                    variant="outline" size="sm"
                    disabled={paiementPage >= paiementTotalPages || loadingPaiements}
                    onClick={() => setPaiementPage((p) => Math.min(paiementTotalPages, p + 1))}
                  >
                    {t('payments_tab.pagination.next')} <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
