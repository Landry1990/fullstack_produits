import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  DollarSign, 
  Calendar,
  Filter,
  CalendarDays,
  Package,
  ClipboardList,
  Warehouse,
  ArrowLeft,
  Eye,
  Boxes,
  Download,
} from 'lucide-react';
import api from '../../services/api';
import { formatDate, formatDateTime, formatDateShort, formatDateLong, getLocalDateString } from '../../utils/dateUtils';
import { formatNumber } from '../../utils/formatters';
import { gooeyToast } from 'goey-toast';
import Commandes from '../Commandes';
import { useCommandesStore } from '../../stores/useCommandesStore';
import { Button } from '../shadcn/button';
import { LocalizedDateInput } from '../LocalizedDateInput';
import { Card } from '../shadcn/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../shadcn/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../shadcn/table';
import { Skeleton } from '../ui/Skeleton';
import PaginationControls from '../ui/PaginationControls';
import { logger } from '../../utils/logger'
import { usePharmacySettings } from '../../hooks/usePharmacySettings';
import { exportToExcel } from '../../utils/excelExport';

interface VenteDivers {
  id: number;
  date: string;
  produit_name: string;
  facture_numero: string;
  quantity: number;
  selling_price: number;
  total: number;
  lot: string;
}

interface VentesDiversesResponse {
  count: number;
  total_ca: number;
  results: VenteDivers[];
}

interface VenteJournaliere {
  date: string;
  total_ca: number;
  total_quantity: number;
  nb_produits: number;
  nb_factures: number;
}

interface VentesJournalieresResponse {
  count: number;
  total_ca: number;
  results: VenteJournaliere[];
}

interface StockDiversResponse {
  is_pmp: boolean;
  type_valorisation: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  tva_breakdown: Array<{
    rate: number;
    ht: number;
    tva: number;
    ttc: number;
  }>;
  rayon_breakdown: Array<{
    name: string;
    ht: number;
    tva: number;
    ttc: number;
  }>;
  details?: Array<{
    lot_id: number;
    lot: string;
    produit_id: number;
    produit: string;
    rayon: string | null;
    quantity: number;
    unit_price: number;
    tva_rate: number;
    ht: number;
    tva: number;
    ttc: number;
    date_expiration: string | null;
  }>;
  date: string;
}

type DiversTab = 'ca' | 'commandes' | 'stock';

const GestionDivers: React.FC<{ defaultTab?: DiversTab }> = ({ defaultTab = 'ca' }) => {
  const { t, i18n } = useTranslation('orders');
  const { settings: pharmacySettings } = usePharmacySettings();
  const numberLocale = i18n.resolvedLanguage?.startsWith('en') ? 'en-US' : 'fr-FR';
  const formatAmount = (value: number) => formatNumber(Number(value || 0), 0, numberLocale);
  const formatRate = (value: number) => formatNumber(Number(value || 0), 2, numberLocale);
  const navigate = useNavigate();
  const location = useLocation();
  const queryTab = new URLSearchParams(location.search).get('tab');
  const initialTab: DiversTab = queryTab === 'commandes' ? 'commandes' : defaultTab;
  const [activeTab, setActiveTab] = useState<DiversTab>(() => initialTab);
  const [loading, setLoading] = useState(false);
  const [ventes, setVentes] = useState<VenteDivers[]>([]);
  const [totalCA, setTotalCA] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [dateRange, setDateRange] = useState(() => ({
    debut: getLocalDateString(),
    fin: getLocalDateString()
  }));
  const [stockData, setStockData] = useState<StockDiversResponse | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [valorisation, setValorisation] = useState<'ACHAT' | 'VENTE'>('ACHAT');
  const [detailsPage, setDetailsPage] = useState(1);
  const detailsPageSize = 20;
  const isInitialMount = useRef(true);

  // Vue journalière
  const [dailyVentes, setDailyVentes] = useState<VenteJournaliere[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'detail'>('daily');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Fix #2 : Reset du store Zustand au démontage pour éviter la pollution LOC/DIR/DIV
  const setActiveTabStore = useCommandesStore((s) => s.setActiveTab);
  const setCommandeType = useCommandesStore((s) => s.setCommandeType);
  useEffect(() => {
    return () => {
      setActiveTabStore('LOC');
      setCommandeType('LOC');
    };
  }, [setActiveTabStore, setCommandeType]);

  const fetchVentesDiverses = useCallback(async (targetPage?: number) => {
    const pageToFetch = targetPage ?? page;
    setLoading(true);
    try {
      const response = await api.get<VentesDiversesResponse>('/caisse/ventes_diverses/', {
        params: {
          date: selectedDate,
          page: pageToFetch,
          page_size: pageSize
        }
      });
      setVentes(response.data.results);
      setTotalCA(response.data.total_ca);
      setTotalCount(response.data.count);
    } catch (error) {
      logger.error('Error fetching divers sales:', error);
      gooeyToast.error(t('divers.error_load_detail'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]); // Retirer 'page' pour éviter la boucle

  const fetchVentesJournalieres = useCallback(async () => {
    setDailyLoading(true);
    try {
      const response = await api.get<VentesJournalieresResponse>('/caisse/ventes_diverses/', {
        params: {
          date_debut: dateRange.debut,
          date_fin: dateRange.fin,
          group_by: 'day'
        }
      });
      setDailyVentes(response.data.results);
      setTotalCA(response.data.total_ca);
      setTotalCount(response.data.count);
    } catch (error) {
      logger.error('Error fetching daily divers sales:', error);
      gooeyToast.error(t('divers.error_load_daily'));
    } finally {
      setDailyLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.debut, dateRange.fin]);

  useEffect(() => {
    if (activeTab === 'ca') {
      if (viewMode === 'daily') {
        fetchVentesJournalieres();
      } else {
        if (isInitialMount.current) {
          isInitialMount.current = false;
          fetchVentesDiverses(1);
        } else {
          fetchVentesDiverses(page);
        }
      }
    }
  }, [activeTab, viewMode, page, fetchVentesJournalieres, fetchVentesDiverses]);

  const handleViewDetail = (date: string) => {
    setSelectedDate(date);
    setViewMode('detail');
    setPage(1);
    // Le useEffect relance fetchVentesDiverses avec le nouveau selectedDate
  };

  const handleBackToDaily = () => {
    setSelectedDate(null);
    setViewMode('daily');
    setVentes([]);
  };

  const fetchStockDivers = useCallback(async () => {
    setStockLoading(true);
    try {
      const response = await api.get<StockDiversResponse>('/rapports/valeur_stock_divers_json/', {
        params: { valorisation }
      });
      setStockData(response.data);
      setDetailsPage(1);
    } catch (error) {
      logger.error('Error fetching divers stock:', error);
      gooeyToast.error(t('divers.error_load_stock'));
    } finally {
      setStockLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorisation]);

  useEffect(() => {
    if (activeTab === 'stock') {
      fetchStockDivers();
    }
  }, [activeTab, fetchStockDivers]);

  // Reset page quand les dates changent
  const handleFilter = () => {
    setPage(1);
    if (viewMode === 'daily') fetchVentesJournalieres();
    else fetchVentesDiverses(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    const tabFromUrl: DiversTab = new URLSearchParams(location.search).get('tab') === 'commandes'
      ? 'commandes'
      : defaultTab;
    setActiveTab(tabFromUrl);
  }, [defaultTab, location.search]);

  const handleTabChange = (tab: DiversTab) => {
    setActiveTab(tab);
    if (tab === 'stock') navigate('/app/divers/stock');
    else if (tab === 'commandes') navigate('/app/divers/ca?tab=commandes');
    else navigate('/app/divers/ca');
  };

  const tabMeta = {
    ca: {
      title: t('divers.revenue_tab'),
      description: t('divers.revenue_description'),
      icon: DollarSign,
      iconClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    },
    commandes: {
      title: t('divers.orders_tab'),
      description: t('divers.orders_description'),
      icon: ShoppingBag,
      iconClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
    },
    stock: {
      title: t('divers.stock_tab'),
      description: t('divers.stock_description'),
      icon: Warehouse,
      iconClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    },
  } satisfies Record<DiversTab, { title: string; description: string; icon: React.ElementType; iconClass: string }>;
  const activeMeta = tabMeta[activeTab];
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="p-2 lg:p-3 h-full flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-950/30">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${activeMeta.iconClass}`}>
          <ActiveIcon className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{activeMeta.title}</h1>
          <p className="text-sm text-muted-foreground">{activeMeta.description}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => handleTabChange(value as DiversTab)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid h-auto w-full grid-cols-1 sm:grid-cols-3 gap-2 bg-transparent p-0">
          <TabsTrigger value="ca" className="h-auto min-h-10 justify-start gap-3 border-2 border-transparent bg-white px-3 py-2 shadow-sm data-[state=active]:border-emerald-500 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800 dark:bg-slate-950 dark:data-[state=active]:bg-emerald-950/40 dark:data-[state=active]:text-emerald-300">
            <DollarSign className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="text-left"><span className="block font-semibold">{t('divers.revenue_tab')}</span><span className="hidden xl:block text-xs font-normal opacity-70">{t('divers.revenue_tab_hint')}</span></span>
          </TabsTrigger>
          <TabsTrigger value="commandes" className="h-auto min-h-10 justify-start gap-3 border-2 border-transparent bg-white px-3 py-2 shadow-sm data-[state=active]:border-amber-500 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800 dark:bg-slate-950 dark:data-[state=active]:bg-amber-950/40 dark:data-[state=active]:text-amber-300">
            <ShoppingBag className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="text-left"><span className="block font-semibold">{t('divers.orders_tab')}</span><span className="hidden xl:block text-xs font-normal opacity-70">{t('divers.orders_tab_hint')}</span></span>
          </TabsTrigger>
          <TabsTrigger value="stock" className="h-auto min-h-10 justify-start gap-3 border-2 border-transparent bg-white px-3 py-2 shadow-sm data-[state=active]:border-emerald-500 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800 dark:bg-slate-950 dark:data-[state=active]:bg-emerald-950/40 dark:data-[state=active]:text-emerald-300">
            <Warehouse className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="text-left"><span className="block font-semibold">{t('divers.stock_tab')}</span><span className="hidden xl:block text-xs font-normal opacity-70">{t('divers.stock_tab_hint')}</span></span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ca" className="flex-1 flex flex-col min-h-0 space-y-4 mt-4 data-[state=inactive]:hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-3">
            <Card className="p-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 w-full sm:w-[190px]">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <LocalizedDateInput value={dateRange.debut} onChange={(e) => setDateRange({ ...dateRange, debut: e.target.value })} className="h-8 min-w-0" aria-label={t('common:from')} />
              </div>
              <span className="hidden sm:inline text-muted-foreground font-medium text-xs">{t('divers.to_date')}</span>
              <div className="flex items-center gap-2 w-full sm:w-[190px]">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <LocalizedDateInput value={dateRange.fin} onChange={(e) => setDateRange({ ...dateRange, fin: e.target.value })} className="h-8 min-w-0" aria-label={t('common:to')} />
              </div>
              <Button onClick={handleFilter} variant="outline" size="sm" className="ml-auto border-emerald-600 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
                <Filter className="h-3.5 w-3.5" />
                {t('divers.filter')}
              </Button>
            </Card>
            <Card className="bg-emerald-600 text-white border-emerald-600 px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-emerald-100 text-[10px] font-semibold uppercase tracking-wider">{t('divers.revenue')}</p>
                <h2 className="text-2xl font-bold leading-tight mt-0.5">{formatAmount(totalCA)} {t('divers.currency')}</h2>
              </div>
              <div className="flex items-center whitespace-nowrap text-emerald-100 text-[10px]">
                <CalendarDays className="h-3 w-3 mr-1" />
                {formatDateShort(dateRange.debut)} → {formatDateShort(dateRange.fin)}
              </div>
            </Card>
          </div>

          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden p-0">
            <div className="px-4 py-3 border-b flex justify-between items-center bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                {viewMode === 'daily' ? (
                  <>
                    <CalendarDays className="h-4 w-4 text-emerald-600" />
                    {t('divers.daily_sales_title')}
                  </>
                ) : (
                  <>
                    <ClipboardList className="h-4 w-4 text-emerald-600" />
                    {t('divers.detail_of')} {selectedDate ? formatDate(selectedDate) : ''}
                  </>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {viewMode === 'detail' && (
                  <Button variant="outline" size="sm" onClick={handleBackToDaily} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> {t('divers.back_to_days')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-200 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50"
                  disabled={viewMode === 'daily' ? dailyVentes.length === 0 : ventes.length === 0}
                  onClick={() => {
                    const currency = t('divers.currency');
                    if (viewMode === 'daily') {
                      const rows = dailyVentes.map((day) => ({
                        [t('divers.table.date')]: formatDateLong(day.date),
                        [t('divers.daily_products')]: day.nb_produits,
                        [t('divers.daily_qty')]: day.total_quantity,
                        [t('divers.daily_invoices')]: day.nb_factures,
                        [`${t('divers.daily_total_ca')} (${currency})`]: day.total_ca,
                      }));
                      exportToExcel(rows, pharmacySettings, {
                        sheetName: t('divers.sheet_ca'),
                        filename: `ca_divers_${dateRange.debut}_${dateRange.fin}.xlsx`,
                        title: `${t('divers.daily_sales_title')} — ${formatDateShort(dateRange.debut)} → ${formatDateShort(dateRange.fin)}`,
                        printA4Portrait: true,
                      });
                    } else {
                      const rows = ventes.map((v) => ({
                        [t('divers.table.date')]: v.date ? formatDateTime(v.date) : '',
                        [t('divers.table.invoice')]: v.facture_numero,
                        [t('divers.table.product')]: v.produit_name,
                        [t('divers.table.lot')]: v.lot,
                        [t('divers.table.qty')]: v.quantity,
                        [t('divers.table.unit_price')]: v.selling_price,
                        [`${t('divers.table.total')} (${currency})`]: v.total,
                      }));
                      exportToExcel(rows, pharmacySettings, {
                        sheetName: t('divers.sheet_sales'),
                        filename: `ventes_divers_${selectedDate ?? getLocalDateString()}.xlsx`,
                        title: `${t('divers.detail_sales')} — ${selectedDate ? formatDate(selectedDate) : ''}`,
                        printA4Portrait: true,
                      });
                    }
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('divers.export_excel')}
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {viewMode === 'daily' ? (
                <Table className="[&_td]:py-2 [&_th]:h-9 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:bg-slate-50 [&_thead_th]:z-10">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('divers.table.date')}</TableHead>
                      <TableHead className="text-right">{t('divers.daily_products')}</TableHead>
                      <TableHead className="text-right">{t('divers.daily_qty')}</TableHead>
                      <TableHead className="text-right">{t('divers.daily_invoices')}</TableHead>
                      <TableHead className="text-right">{t('divers.daily_total_ca')}</TableHead>
                      <TableHead className="text-center">{t('divers.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={6}><Skeleton className="h-4 w-full" /></TableCell>
                        </TableRow>
                      ))
                    ) : dailyVentes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-12">{t('divers.no_sales_found')}</TableCell>
                      </TableRow>
                    ) : (
                      dailyVentes.map((day) => (
                        <TableRow
                          key={day.date}
                          className="cursor-pointer hover:bg-emerald-50/50 transition-colors"
                          onClick={() => handleViewDetail(day.date)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleViewDetail(day.date);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`${t('common:details')} ${formatDateLong(day.date)}`}
                        >
                          <TableCell className="font-medium">
                            {formatDateLong(day.date)}
                          </TableCell>
                          <TableCell className="text-right">{day.nb_produits}</TableCell>
                          <TableCell className="text-right">{day.total_quantity}</TableCell>
                          <TableCell className="text-right">{day.nb_factures}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">{formatAmount(day.total_ca)} {t('divers.currency')}</TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewDetail(day.date); }} className="text-emerald-600 h-8 w-8 p-0" aria-label={t('common:details')}>
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : (
                <Table className="[&_td]:py-2 [&_th]:h-9 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:bg-slate-50 [&_thead_th]:z-10">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('divers.table.date')}</TableHead>
                      <TableHead>{t('divers.table.invoice')}</TableHead>
                      <TableHead>{t('divers.table.product')}</TableHead>
                      <TableHead>{t('divers.table.lot')}</TableHead>
                      <TableHead className="text-right">{t('divers.table.qty')}</TableHead>
                      <TableHead className="text-right">{t('divers.table.unit_price')}</TableHead>
                      <TableHead className="text-right">{t('divers.table.total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={7}><Skeleton className="h-4 w-full" /></TableCell>
                        </TableRow>
                      ))
                    ) : ventes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-12">{t('divers.no_sales_found')}</TableCell>
                      </TableRow>
                    ) : (
                      ventes.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="text-muted-foreground">{v.date ? formatDateTime(v.date) : t('divers.not_available')}</TableCell>
                          <TableCell className="font-medium text-emerald-600">{v.facture_numero}</TableCell>
                          <TableCell>{v.produit_name}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-600">{v.lot}</TableCell>
                          <TableCell className="text-right font-medium">{v.quantity}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatAmount(v.selling_price)}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">{formatAmount(v.total)} {t('divers.currency')}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
            {viewMode === 'daily' && dailyVentes.length > 0 && (
              <div className="px-4 py-3 border-t bg-muted/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-x-3 gap-y-1 text-xs">
                    <span className="text-muted-foreground"><strong className="text-slate-700">{dailyVentes.reduce((s, d) => s + d.nb_produits, 0)}</strong> {t('divers.products_count')}</span>
                    <span className="text-muted-foreground"><strong className="text-slate-700">{dailyVentes.reduce((s, d) => s + d.total_quantity, 0)}</strong> {t('divers.quantities_count')}</span>
                    <span className="text-muted-foreground"><strong className="text-slate-700">{dailyVentes.reduce((s, d) => s + d.nb_factures, 0)}</strong> {t('divers.invoices_count')}</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-600">
                    {t('divers.total_label')} : {formatAmount(totalCA)} {t('divers.currency')}
                  </div>
                </div>
              </div>
            )}
            {viewMode === 'detail' && totalPages > 1 && (
              <div className="px-4 py-3 border-t flex items-center justify-between bg-muted/30">
                <span className="text-sm text-muted-foreground">{t('divers.page_label')} {page} {t('divers.of_label')} {totalPages} · {totalCount} {t('divers.results')}</span>
                <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="commandes" className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden">
          <Commandes forcedType="DIV" embedded />
        </TabsContent>

        <TabsContent value="stock" className="flex-1 min-h-0 overflow-auto space-y-4 mt-4 data-[state=inactive]:hidden">
          <Card className="p-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('divers.valuation_method')}</span>
              <div className="flex gap-2">
                <Button variant={valorisation === 'ACHAT' ? 'default' : 'outline'} size="sm" onClick={() => setValorisation('ACHAT')} aria-pressed={valorisation === 'ACHAT'} className={valorisation === 'ACHAT' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'hover:border-emerald-500 hover:text-emerald-600'}>
                  {t('divers.purchase_cost')}
                </Button>
                <Button variant={valorisation === 'VENTE' ? 'default' : 'outline'} size="sm" onClick={() => setValorisation('VENTE')} aria-pressed={valorisation === 'VENTE'} className={valorisation === 'VENTE' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'hover:border-emerald-500 hover:text-emerald-600'}>
                  {t('divers.selling_price')}
                </Button>
              </div>
            </div>
          </Card>

          {stockLoading ? (
            <Card className="p-10 text-center">
              <Skeleton className="h-8 w-8 rounded-full mx-auto" />
              <p className="mt-4 text-muted-foreground">{t('divers.loading_valuation')}</p>
            </Card>
          ) : stockData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="bg-emerald-600 text-white border-emerald-600 px-4 py-3">
                  <p className="text-emerald-100 text-[10px] font-semibold uppercase tracking-wider">{t('divers.total_value_ttc')}</p>
                  <h2 className="text-xl sm:text-2xl font-bold leading-tight mt-0.5">{formatAmount(stockData.total_ttc)} {t('divers.currency')}</h2>
                  <p className="mt-1 text-emerald-100 text-[10px]">{stockData.type_valorisation === 'PMP' ? t('divers.purchase_cost') : t('divers.selling_price')}</p>
                </Card>
                <Card className="px-4 py-3">
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">{t('divers.value_ht')}</p>
                  <h2 className="text-lg sm:text-xl font-bold leading-tight mt-0.5">{formatAmount(stockData.total_ht)} {t('divers.currency')}</h2>
                </Card>
                <Card className="px-4 py-3">
                  <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">{t('divers.total_vat')}</p>
                  <h2 className="text-lg sm:text-xl font-bold leading-tight mt-0.5">{formatAmount(stockData.total_tva)} {t('divers.currency')}</h2>
                </Card>
              </div>

              <Card className="overflow-hidden p-0">
                <div className="px-4 py-3 border-b bg-muted/30">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <ClipboardList className="h-4 w-4 text-emerald-600" />
                    {t('divers.vat_breakdown')}
                  </h3>
                </div>
                <div className="overflow-auto">
                  <Table className="[&_td]:py-2 [&_th]:h-9 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:bg-slate-50 [&_thead_th]:z-10">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('divers.table.vat_rate')}</TableHead>
                        <TableHead className="text-right">{t('divers.table.base_ht')}</TableHead>
                        <TableHead className="text-right">{t('divers.table.vat_amount')}</TableHead>
                        <TableHead className="text-right">{t('divers.table.total_ttc')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockData.tva_breakdown.map((item) => (
                        <TableRow key={item.rate}>
                          <TableCell className="font-medium">{formatRate(item.rate)}%</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatAmount(item.ht)} {t('divers.currency')}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatAmount(item.tva)} {t('divers.currency')}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">{formatAmount(item.ttc)} {t('divers.currency')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <Card className="overflow-hidden p-0">
                <div className="px-4 py-3 border-b bg-muted/30">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-emerald-600" />
                    {t('divers.section_breakdown')}
                  </h3>
                </div>
                <div className="overflow-auto">
                  <Table className="[&_td]:py-2 [&_th]:h-9 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:bg-slate-50 [&_thead_th]:z-10">
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('divers.table.section')}</TableHead>
                        <TableHead className="text-right">{t('divers.table.base_ht')}</TableHead>
                        <TableHead className="text-right">{t('divers.table.vat_amount')}</TableHead>
                        <TableHead className="text-right">{t('divers.table.total_ttc')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockData.rayon_breakdown.map((item) => (
                        <TableRow key={item.name}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatAmount(item.ht)} {t('divers.currency')}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatAmount(item.tva)} {t('divers.currency')}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">{formatAmount(item.ttc)} {t('divers.currency')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {stockData.details && stockData.details.length > 0 && (() => {
                const detailsTotalPages = Math.ceil(stockData.details.length / detailsPageSize);
                const safeDetailsPage = Math.min(detailsPage, detailsTotalPages);
                const pagedDetails = stockData.details.slice((safeDetailsPage - 1) * detailsPageSize, safeDetailsPage * detailsPageSize);
                return (
                <Card className="overflow-hidden p-0">
                  <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-semibold flex items-center gap-2 text-sm">
                      <Boxes className="h-4 w-4 text-emerald-600" />
                      {t('divers.lot_details')}
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-emerald-200 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50"
                      onClick={() => {
                        const rows = (stockData.details ?? []).map((item) => ({
                          [t('divers.table.product')]: item.produit,
                          [t('divers.table.lot')]: item.lot,
                          [t('divers.table.section')]: item.rayon || t('divers.unclassified'),
                          [t('divers.table.remaining_qty')]: item.quantity,
                          [t('divers.table.unit_price')]: item.unit_price,
                          [`${t('divers.table.vat_rate')} (%)`]: item.tva_rate,
                          [t('divers.table.base_ht')]: item.ht,
                          [t('divers.table.vat_amount')]: item.tva,
                          [t('divers.table.expiry')]: item.date_expiration ? formatDate(item.date_expiration) : '',
                          [t('divers.table.total_ttc')]: item.ttc,
                        }));
                        exportToExcel(rows, pharmacySettings, {
                          sheetName: t('divers.sheet_lots'),
                          filename: `lots_divers_${valorisation.toLowerCase()}_${getLocalDateString()}.xlsx`,
                          title: `${t('divers.lot_details')} — ${stockData.type_valorisation === 'PMP' ? t('divers.purchase_cost') : t('divers.selling_price')}`,
                          printA4Portrait: true,
                        });
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t('divers.export_excel')}
                    </Button>
                  </div>
                  <div className="overflow-auto">
                    <Table className="[&_td]:py-2 [&_th]:h-9 [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:bg-slate-50 [&_thead_th]:z-10">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('divers.table.product')}</TableHead>
                          <TableHead>{t('divers.table.lot')}</TableHead>
                          <TableHead>{t('divers.table.section')}</TableHead>
                          <TableHead className="text-right">{t('divers.table.remaining_qty')}</TableHead>
                          <TableHead className="text-right">{t('divers.table.unit_price')}</TableHead>
                          <TableHead className="text-right">{t('divers.table.vat_rate')}</TableHead>
                          <TableHead>{t('divers.table.expiry')}</TableHead>
                          <TableHead className="text-right">{t('divers.table.total_ttc')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedDetails.map((item) => (
                          <TableRow key={item.lot_id}>
                            <TableCell className="font-medium">{item.produit}</TableCell>
                            <TableCell className="text-muted-foreground">{item.lot || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">{item.rayon || t('divers.unclassified')}</TableCell>
                            <TableCell className="text-right">{formatAmount(item.quantity)}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{formatAmount(item.unit_price)} {t('divers.currency')}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{formatRate(item.tva_rate)}%</TableCell>
                            <TableCell className="text-muted-foreground">{item.date_expiration ? formatDate(item.date_expiration) : t('divers.no_expiry')}</TableCell>
                            <TableCell className="text-right font-bold text-emerald-600">{formatAmount(item.ttc)} {t('divers.currency')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {detailsTotalPages > 1 && (
                    <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-xs text-muted-foreground">{t('divers.page_label')} {safeDetailsPage} {t('divers.of_label')} {detailsTotalPages} · {stockData.details.length} {t('divers.results')}</span>
                      <PaginationControls page={safeDetailsPage} totalPages={detailsTotalPages} onPageChange={setDetailsPage} />
                    </div>
                  )}
                </Card>
                );
              })()}
            </>
          ) : (
            <Card className="p-12 text-center">
              <Warehouse className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t('divers.no_stock_data')}</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GestionDivers;
