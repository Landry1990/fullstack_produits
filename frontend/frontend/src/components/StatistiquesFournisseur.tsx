import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft, ChevronRight, Download, AlertTriangle, Building2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { formatDate as formatDateDisplay } from '../utils/dateUtils';
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
import { Badge } from './shadcn/badge';
import { Tabs, TabsList, TabsTrigger } from './shadcn/tabs';
import { Input } from './ui/Input';
import { LocalizedDateInput } from './LocalizedDateInput';
import { Select } from './ui/Select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './shadcn/table';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import SkeletonTable from './ui/SkeletonTable';
import { PageContainer } from './ui/PageContainer';
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
  const location = useLocation();
  const navigate = useNavigate();
  // Persiste l'onglet actif dans l'historique du navigateur pour qu'il survive à un F5.
  const [activeTab, setActiveTabState] = useState<string>(
    () => (location.state as { activeSupplierStatsTab?: string } | null)?.activeSupplierStatsTab || 'ventes'
  );
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    navigate(location.pathname, { replace: true, state: { ...(location.state || {}), activeSupplierStatsTab: tab } });
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
  // Preset de période : 'month' = mois courant (défaut), '90d', '12m', 'custom' = dates libres
  const [periodPreset, setPeriodPreset] = useState<'month' | '90d' | '12m' | 'custom'>('month');

  // Hooks pour les nouvelles analyses (période synchronisée avec le sélecteur global)
  const { data: supplierAnalysis, isLoading: loadingAnalysis } = useAnalyseFournisseurs(dateDebut, dateFin);
  const { data: prixComparaison, isLoading: loadingPrix } = useComparaisonPrix(dateDebut, dateFin);
  const { data: repartitionAchats, isLoading: loadingRepartition } = useRepartitionAchats(dateDebut, dateFin);


  const fetchStats = async (debut: string = dateDebut, fin: string = dateFin) => {
    try {
      setLoading(true);

      const response = await api.get('statistiques/ca_par_fournisseur/', {
        params: {
          date_debut: debut,
          date_fin: fin
        }
      });

      setStats(response.data);
    } catch (error) {
      logger.error("Erreur lors du chargement des statistiques", error);
    } finally {
      setLoading(false);
    }
  };

  // Applique un preset de période : recalcule les bornes puis recharge l'onglet ventes.
  // En mode 'custom', on laisse l'utilisateur ajuster les dates puis cliquer sur Actualiser.
  const applyPreset = (preset: 'month' | '90d' | '12m' | 'custom') => {
    setPeriodPreset(preset);
    if (preset === 'custom') return;

    const today = new Date();
    const debut = new Date(today);
    if (preset === 'month') {
      debut.setDate(1); // 1er du mois
    } else if (preset === '90d') {
      debut.setDate(debut.getDate() - 89); // aujourd'hui - 89j → aujourd'hui
    } else {
      debut.setMonth(debut.getMonth() - 12); // 12 derniers mois
    }
    const debutStr = formatDate(debut);
    const finStr = formatDate(today);
    setDateDebut(debutStr);
    setDateFin(finStr);
    fetchStats(debutStr, finStr);
  };

  // Toute modification manuelle d'une borne bascule le sélecteur en mode 'custom'
  const handleDateDebutChange = (value: string) => {
    setDateDebut(value);
    setPeriodPreset('custom');
  };

  const handleDateFinChange = (value: string) => {
    setDateFin(value);
    setPeriodPreset('custom');
  };

  useEffect(() => {
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // ── TAB PAIEMENTS: Historique généralisé des paiements fournisseurs ──
  const [paiements, setPaiements] = useState<PaiementFournisseur[]>([]);
  const [paiementsCount, setPaiementsCount] = useState(0);
  const [paiementsTotals, setPaiementsTotals] = useState<{ total_montant: number; count: number } | null>(null);
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
      const filterParams = {
        fournisseur: paiementFournisseurFilter ? Number(paiementFournisseurFilter) : undefined,
        mode_paiement: paiementModeFilter || undefined,
        date_debut: paiementDateDebut || undefined,
        date_fin: paiementDateFin || undefined,
        search: paiementSearch || undefined,
      };
      const [data, totals] = await Promise.all([
        financeService.getPaiementsHistory({
          ...filterParams,
          page: paiementPage,
          page_size: PAIEMENT_PAGE_SIZE
        }),
        financeService.getPaiementsTotals(filterParams),
      ]);
      setPaiements(data.results || []);
      setPaiementsCount(data.count || 0);
      setPaiementsTotals(totals);
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
  if (!Recharts) return <PageContainer variant="dense"><Skeleton className="h-96 w-full" /></PageContainer>;
  const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } = Recharts;

  return (
    <PageContainer variant="dense" className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-start">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-base-content">{t('title')}</h1>
            <p className="text-sm text-base-content/80">{t('subtitle')}</p>
          </div>
          <Button
            variant="outline" size="sm"
            onClick={() => navigate('/app/fournisseurs')}
          >
            <Building2 className="size-4" />
            {t('links.manage_suppliers')}
          </Button>
        </div>

        {/* Sélecteur de période global : s'applique à tous les onglets sauf 'paiements'
            (qui possède ses propres filtres de dates) */}
        {activeTab !== 'paiements' && (
            <div className="flex flex-col gap-2 bg-base-100 p-2 sm:p-3 rounded-lg shadow-sm border border-base-200 w-full md:w-auto">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-base-content/70 mr-1">{t('period.label')}</span>
                {(['month', '90d', '12m', 'custom'] as const).map((preset) => (
                <Button
                    key={preset}
                    variant={periodPreset === preset ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2.5"
                    onClick={() => applyPreset(preset)}
                >
                    {t(`period.presets.${preset}`)}
                </Button>
                ))}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex flex-col gap-1 w-full sm:w-40">
                <label className="flex flex-col py-1"><span className="text-sm font-medium text-xs">{t('filters.from')}</span></label>
                <LocalizedDateInput

                className="w-full rounded-lg border border-base-300 bg-base-100 h-9 text-xs px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                value={dateDebut}
                onChange={(e) => handleDateDebutChange(e.target.value)}
                aria-label={t('filters.from')}
                />
            </div>
            <div className="flex flex-col gap-1 w-full sm:w-40">
                <label className="flex flex-col py-1"><span className="text-sm font-medium text-xs">{t('filters.to')}</span></label>
                <LocalizedDateInput

                className="w-full rounded-lg border border-base-300 bg-base-100 h-9 text-xs px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                value={dateFin}
                onChange={(e) => handleDateFinChange(e.target.value)}
                aria-label={t('filters.to')}
                />
            </div>
            <Button
                variant="default" size="sm" className="w-full sm:w-auto h-9"
                onClick={() => fetchStats()}
                disabled={loading}
            >
                {loading ? <Loader2 className="size-3 animate-spin" /> : t('filters.refresh')}
            </Button>
            </div>
            </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="w-full max-w-full overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0">
          <TabsList className="w-max min-w-full sm:min-w-0 sm:w-fit bg-base-100 border border-base-200">
            <TabsTrigger value="ventes">{t('tabs.sales')}</TabsTrigger>
            <TabsTrigger value="performance">{t('tabs.performance')}</TabsTrigger>
            <TabsTrigger value="prix">{t('tabs.price_comparison')}</TabsTrigger>
            <TabsTrigger value="concentration">{t('tabs.concentration')}</TabsTrigger>
            <TabsTrigger value="paiements">{t('tabs.payments')}</TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {/* TAB 1: VENTES (Existing Content) */}
      {activeTab === 'ventes' && (
        <div className="space-y-6 animate-fade-in">
           {/* Info Box */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-info/10 text-info border border-info/20 shadow-sm">
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
                    <h3 className="text-2xl font-bold text-info">{totaux.quantite_vendue}</h3>
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
                <div className="overflow-x-auto">
                <Table className="table-fixed min-w-[640px]">
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
                                <TableCell colSpan={6} className="px-3 py-8">
                                    <EmptyState compact title={t('sales_tab.table.no_data')} />
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
                </div>
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
            <div className="p-4">
              <SkeletonTable rows={5} columns={5} />
            </div>
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table className="table-fixed min-w-[640px]">
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
                        <TableCell colSpan={5} className="px-3 py-8">
                          <EmptyState compact title={t('performance_tab.no_data', { defaultValue: 'Aucune analyse disponible' })} />
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
                              <Badge className={scoreColor}>
                                {item.score_global}/100
                              </Badge>
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
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 3: COMPARATEUR PRIX */}
      {activeTab === 'prix' && (
        <div className="space-y-6 animate-fade-in">
             <div className="flex items-start gap-3 p-4 rounded-lg bg-success-soft text-success-strong border border-success shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                <h3 className="font-bold">{t('prices_tab.alert_title')}</h3>
                <div className="text-sm">{t('prices_tab.alert_text')}</div>
                </div>
            </div>

            {loadingPrix ? (
                <div className="p-4">
                    <SkeletonTable rows={5} columns={4} />
                 </div>
            ) : (
                <Card className="bg-base-100 shadow-sm border border-base-200">
                    <div className="overflow-x-auto">
                    <Table className="table-fixed min-w-[640px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[25%] px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('prices_tab.table.product')}</TableHead>
                                <TableHead className="w-24 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('prices_tab.table.max_gap')}</TableHead>
                                <TableHead className="w-[40%] px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('prices_tab.table.offers')}</TableHead>
                                <TableHead className="w-32 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-right">{t('prices_tab.table.best_price')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(() => {
                                const filtered = (prixComparaison ?? []).filter((prod) => prod.ecart_pourcentage > 0);
                                if (filtered.length === 0) {
                                    return (
                                        <TableRow>
                                            <TableCell colSpan={4} className="px-3 py-8">
                                                <EmptyState compact title={t('prices_tab.table.no_data')} />
                                            </TableCell>
                                        </TableRow>
                                    );
                                }
                                return filtered.map((prod) => (
                                    <TableRow key={prod.id}>
                                        <TableCell className="px-3 py-2 font-medium max-w-xs truncate" title={prod.produit}>{prod.produit}</TableCell>
                                        <TableCell className="px-3 py-2 text-center">
                                            {prod.ecart_pourcentage > 20 ? (
                                                <Badge variant="destructive">{prod.ecart_pourcentage}%</Badge>
                                            ) : prod.ecart_pourcentage > 5 ? (
                                                <Badge className="bg-amber-500 text-white border-transparent">{prod.ecart_pourcentage}%</Badge>
                                            ) : (
                                                <Badge variant="outline">{prod.ecart_pourcentage}%</Badge>
                                            )}
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
                                ));
                            })()}
                        </TableBody>
                    </Table>
                    </div>
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
                        <Skeleton className="h-64 w-full" />
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
                            
                            <div className="flex-1 w-full overflow-x-auto">
                                <Table className="table-fixed min-w-[560px]">
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
                  aria-label={t('payments_tab.filters.supplier')}
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
                  aria-label={t('payments_tab.filters.mode')}
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
                <div className="w-full">
                  <label className="block text-caption font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {t('payments_tab.filters.from')}
                  </label>
                  <LocalizedDateInput
                    aria-label={t('payments_tab.filters.from')}
                    className="w-full rounded-lg border border-slate-300 bg-white h-9 text-xs px-3 outline-none hover:border-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                    value={paiementDateDebut}
                    onChange={(e) => { setPaiementDateDebut(e.target.value); setPaiementPage(1); }}
                  />
                </div>
                <div className="w-full">
                  <label className="block text-caption font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    {t('payments_tab.filters.to')}
                  </label>
                  <LocalizedDateInput
                    aria-label={t('payments_tab.filters.to')}
                    className="w-full rounded-lg border border-slate-300 bg-white h-9 text-xs px-3 outline-none hover:border-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all"
                    value={paiementDateFin}
                    onChange={(e) => { setPaiementDateFin(e.target.value); setPaiementPage(1); }}
                  />
                </div>
                <Input
                  label={t('payments_tab.filters.search')}
                  aria-label={t('payments_tab.filters.search')}
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

          {/* Cartes Résumé (total serveur, tous filtres appliqués) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="shadow-sm border border-slate-200">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-slate-500">{t('payments_tab.cards.total_paid')}</p>
                <h3 className="text-2xl font-bold text-success">
                  {formatCurrency(Math.round(paiementsTotals?.total_montant ?? 0), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}
                </h3>
              </CardContent>
            </Card>
            <Card className="shadow-sm border border-slate-200">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-slate-500">{t('payments_tab.cards.payments_count')}</p>
                <h3 className="text-2xl font-bold text-primary">{paiementsTotals?.count ?? paiementsCount}</h3>
              </CardContent>
            </Card>
          </div>

          {/* Tableau */}
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table className="table-fixed min-w-[720px]">
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
                        <TableCell colSpan={7} className="px-3 py-6">
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paiements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="px-3 py-8">
                          <EmptyState compact title={t('payments_tab.table.no_data')} />
                        </TableCell>
                      </TableRow>
                    ) : (
                      paiements.map((p) => (
                        <TableRow key={p.id} title={p.notes || undefined}>
                          <TableCell className="px-3 py-2 whitespace-nowrap text-slate-700">{formatDateDisplay(p.date_paiement)}</TableCell>
                          <TableCell className="px-3 py-2 font-medium text-slate-900">{p.fournisseur_name}</TableCell>
                          <TableCell className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(Math.round(Number(p.montant)), i18n.language === 'fr' ? 'fr-FR' : 'en-GB', t('common:currency'))}</TableCell>
                          <TableCell className="px-3 py-2"><Badge variant="outline">{t(`payments_tab.modes.${p.mode_paiement}`)}</Badge></TableCell>
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
              </div>

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

    </PageContainer>
  );
}
