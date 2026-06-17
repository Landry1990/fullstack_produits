import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ShoppingBag, 
  DollarSign, 
  Calendar,
  Filter,
  CalendarDays,
  Package,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Warehouse
} from 'lucide-react';
import api from '../../services/api';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Commandes from '../Commandes';
import { useCommandesStore } from '../../stores/useCommandesStore';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/Table';
import { Badge } from '../ui/Badge';

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
  date: string;
}

const GestionDivers: React.FC<{ defaultTab?: 'ca' | 'commandes' | 'stock' }> = ({ defaultTab = 'ca' }) => {
  const { t } = useTranslation('orders');
  const [activeTab, setActiveTab] = useState<'ca' | 'commandes' | 'stock'>(() => defaultTab);
  const [loading, setLoading] = useState(false);
  const [ventes, setVentes] = useState<VenteDivers[]>([]);
  const [totalCA, setTotalCA] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [dateRange, setDateRange] = useState(() => ({
    debut: format(new Date(), 'yyyy-MM-dd'),
    fin: format(new Date(), 'yyyy-MM-dd')
  }));
  const [stockData, setStockData] = useState<StockDiversResponse | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [valorisation, setValorisation] = useState<'ACHAT' | 'VENTE'>('ACHAT');
  const isInitialMount = useRef(true);

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
          date_debut: dateRange.debut,
          date_fin: dateRange.fin,
          page: pageToFetch,
          page_size: pageSize
        }
      });
      setVentes(response.data.results);
      setTotalCA(response.data.total_ca);
      setTotalCount(response.data.count);
    } catch (error) {
      console.error('Error fetching divers sales:', error);
      toast.error('Erreur lors du chargement des ventes diverses');
    } finally {
      setLoading(false);
    }
  }, [dateRange.debut, dateRange.fin]); // Retirer 'page' pour éviter la boucle

  useEffect(() => {
    if (activeTab === 'ca') {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        fetchVentesDiverses(1);
      } else {
        fetchVentesDiverses(page);
      }
    }
  }, [activeTab, page]); // Retirer fetchVentesDiverses des dépendances

  const fetchStockDivers = useCallback(async () => {
    setStockLoading(true);
    try {
      const response = await api.get<StockDiversResponse>('/rapports/valeur_stock_divers_json/', {
        params: { valorisation }
      });
      setStockData(response.data);
    } catch (error) {
      console.error('Error fetching divers stock:', error);
      toast.error('Erreur lors du chargement de la valorisation du stock divers');
    } finally {
      setStockLoading(false);
    }
  }, [valorisation]);

  useEffect(() => {
    if (activeTab === 'stock') {
      fetchStockDivers();
    }
  }, [activeTab, fetchStockDivers]);

  // Reset page quand les dates changent
  const handleFilter = () => {
    setPage(1);
    fetchVentesDiverses(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-6 h-full flex flex-col space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
          <Package className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('divers.revenue_tab')}</h1>
          <p className="text-sm text-muted-foreground">{t('divers.imported_products_management')}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ca' | 'commandes' | 'stock')} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="ca" className="gap-2">
            <DollarSign className="h-4 w-4" />
            {t('divers.revenue')}
          </TabsTrigger>
          <TabsTrigger value="commandes" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            {t('divers.orders_tab')}
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-2">
            <Warehouse className="h-4 w-4" />
            {t('divers.stock_tab')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ca" className="flex-1 flex flex-col min-h-0 space-y-6 mt-6 data-[state=inactive]:hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input type="date" value={dateRange.debut} onChange={(e) => setDateRange({ ...dateRange, debut: e.target.value })} className="h-9" />
              </div>
              <span className="text-muted-foreground font-medium text-sm">à</span>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input type="date" value={dateRange.fin} onChange={(e) => setDateRange({ ...dateRange, fin: e.target.value })} className="h-9" />
              </div>
              <Button onClick={handleFilter} variant="outline" className="gap-2 ml-auto border-emerald-600 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
                <Filter className="h-4 w-4" />
                {t('divers.filter')}
              </Button>
            </Card>
            <Card className="bg-emerald-600 text-white border-emerald-600 p-6 flex flex-col justify-center">
              <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">{t('divers.revenue')}</p>
              <h2 className="text-3xl font-bold mt-1">{totalCA.toLocaleString()} F</h2>
              <div className="mt-3 flex items-center text-emerald-100 text-xs">
                <CalendarDays className="h-3 w-3 mr-1" />
                {format(new Date(dateRange.debut), 'dd/MM/yy')} → {format(new Date(dateRange.fin), 'dd/MM/yy')}
              </div>
            </Card>
          </div>

          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden p-0">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-muted/30">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <ClipboardList className="h-4 w-4 text-emerald-600" />
                {t('divers.detail_sales')}
              </h3>
              <span className="text-xs text-muted-foreground">{t('divers.transactions_found', { count: totalCount })}</span>
            </div>
            <div className="flex-1 overflow-auto">
              <Table>
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
                        <TableCell colSpan={7}><div className="h-4 bg-muted rounded animate-pulse w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : ventes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">{t('divers.no_sales_found')}</TableCell>
                    </TableRow>
                  ) : (
                    ventes.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="text-muted-foreground">{v.date ? format(parseISO(v.date), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'N/A'}</TableCell>
                        <TableCell className="font-medium text-emerald-600">{v.facture_numero}</TableCell>
                        <TableCell>{v.produit_name}</TableCell>
                        <TableCell><Badge variant="secondary">{v.lot}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{v.quantity}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{v.selling_price.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">{v.total.toLocaleString()} F</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t flex items-center justify-between bg-muted/30">
                <span className="text-sm text-muted-foreground">Page {page} / {totalPages} · {totalCount} {t('divers.results')}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> {t('divers.previous')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    {t('divers.next')} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="commandes" className="flex-1 min-h-0 mt-6 data-[state=inactive]:hidden">
          <Commandes forcedType="DIV" />
        </TabsContent>

        <TabsContent value="stock" className="flex-1 min-h-0 overflow-auto space-y-6 mt-6 data-[state=inactive]:hidden">
          <Card className="p-6">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium">{t('divers.valuation_method')}</span>
              <div className="flex gap-2">
                <Button variant={valorisation === 'ACHAT' ? 'primary' : 'outline'} size="sm" onClick={() => setValorisation('ACHAT')}>
                  {t('divers.purchase_cost')}
                </Button>
                <Button variant={valorisation === 'VENTE' ? 'primary' : 'outline'} size="sm" onClick={() => setValorisation('VENTE')}>
                  {t('divers.selling_price')}
                </Button>
              </div>
            </div>
          </Card>

          {stockLoading ? (
            <Card className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto" />
              <p className="mt-4 text-muted-foreground">{t('divers.loading_valuation')}</p>
            </Card>
          ) : stockData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-emerald-600 text-white border-emerald-600 p-6">
                  <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">{t('divers.total_value_ttc')}</p>
                  <h2 className="text-3xl font-bold mt-1">{stockData.total_ttc.toLocaleString()} F</h2>
                  <p className="mt-2 text-emerald-100 text-xs">{stockData.type_valorisation === 'PMP' ? t('divers.purchase_cost') : t('divers.selling_price')}</p>
                </Card>
                <Card className="p-6">
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">{t('divers.value_ht')}</p>
                  <h2 className="text-2xl font-bold mt-1">{stockData.total_ht.toLocaleString()} F</h2>
                </Card>
                <Card className="p-6">
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">{t('divers.total_vat')}</p>
                  <h2 className="text-2xl font-bold mt-1">{stockData.total_tva.toLocaleString()} F</h2>
                </Card>
              </div>

              <Card className="overflow-hidden p-0">
                <div className="px-6 py-4 border-b bg-muted/30">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <ClipboardList className="h-4 w-4 text-emerald-600" />
                    {t('divers.vat_breakdown')}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('divers.table.vat_rate')}</TableHead>
                        <TableHead className="text-right">{t('divers.table.base_ht')}</TableHead>
                        <TableHead className="text-right">{t('divers.table.vat_amount')}</TableHead>
                        <TableHead className="text-right">{t('divers.table.total_ttc')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockData.tva_breakdown.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.rate}%</TableCell>
                          <TableCell className="text-right text-muted-foreground">{item.ht.toLocaleString()} F</TableCell>
                          <TableCell className="text-right text-muted-foreground">{item.tva.toLocaleString()} F</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">{item.ttc.toLocaleString()} F</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <Card className="overflow-hidden p-0">
                <div className="px-6 py-4 border-b bg-muted/30">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-emerald-600" />
                    {t('divers.section_breakdown')}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('divers.table.section')}</TableHead>
                        <TableHead className="text-right">{t('divers.table.base_ht')}</TableHead>
                        <TableHead className="text-right">{t('divers.table.vat_amount')}</TableHead>
                        <TableHead className="text-right">{t('divers.table.total_ttc')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockData.rayon_breakdown.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{item.ht.toLocaleString()} F</TableCell>
                          <TableCell className="text-right text-muted-foreground">{item.tva.toLocaleString()} F</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">{item.ttc.toLocaleString()} F</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
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
