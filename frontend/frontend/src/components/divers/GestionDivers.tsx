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
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-base-content flex items-center">
            <Package className="h-8 w-8 mr-3 text-primary" />
            {t('divers.revenue_tab')}
          </h1>
          <p className="text-base-content/60 mt-1">
            {t('divers.imported_products_management')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-base-300 mb-6 bg-base-100 rounded-t-xl overflow-hidden shadow-sm">
        <button
          onClick={() => setActiveTab('ca')}
          className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
            activeTab === 'ca'
              ? 'text-primary border-b-2 border-indigo-600 bg-primary/10'
              : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
          }`}
        >
          <div className="flex items-center justify-center">
            <DollarSign className="h-5 w-5 mr-2" />
            {t('divers.revenue')}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('commandes')}
          className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
            activeTab === 'commandes'
              ? 'text-primary border-b-2 border-indigo-600 bg-primary/10'
              : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
          }`}
        >
          <div className="flex items-center justify-center">
            <ShoppingBag className="h-5 w-5 mr-2" />
            {t('divers.orders_tab')}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
            activeTab === 'stock'
              ? 'text-primary border-b-2 border-indigo-600 bg-primary/10'
              : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
          }`}
        >
          <div className="flex items-center justify-center">
            <Warehouse className="h-5 w-5 mr-2" />
            {t('divers.stock_tab')}
          </div>
        </button>
      </div>

      {activeTab === 'ca' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Filters & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-base-100 p-6 rounded-xl shadow-sm border border-base-200 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[150px] flex items-center">
                <Calendar className="h-5 w-5 text-base-content/50 mr-2" />
                <input
                  type="date"
                  value={dateRange.debut}
                  onChange={(e) => setDateRange({ ...dateRange, debut: e.target.value })}
                  className="input input-bordered h-10 w-full sm:w-40 focus:border-primary focus:ring-primary"
                />
              </div>
              <span className="text-base-content/50 font-medium">à</span>
              <div className="flex-1 min-w-[150px] flex items-center">
                <Calendar className="h-5 w-5 text-base-content/50 mr-2" />
                <input
                  type="date"
                  value={dateRange.fin}
                  onChange={(e) => setDateRange({ ...dateRange, fin: e.target.value })}
                  className="input input-bordered h-10 w-full sm:w-40 focus:border-primary focus:ring-primary"
                />
              </div>
              <button
                onClick={handleFilter}
                className="ml-auto inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary-focus focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              >
                <Filter className="h-4 w-4 mr-2" />
                {t('divers.filter')}
              </button>
            </div>

            <div className="bg-primary p-6 rounded-xl shadow-md text-white">
              <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-1">{t('divers.revenue')}</p>
              <h2 className="text-3xl font-bold">{totalCA.toLocaleString()} F</h2>
              <div className="mt-4 flex items-center text-indigo-100 text-xs">
                <CalendarDays className="h-3 w-3 mr-1" />
                {t('divers.period_from')} {format(new Date(dateRange.debut), 'dd/MM/yy')} {t('divers.to')} {format(new Date(dateRange.fin), 'dd/MM/yy')}
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-base-200 bg-base-200 flex justify-between items-center">
              <h3 className="font-semibold text-base-content flex items-center">
                <ClipboardList className="h-5 w-5 mr-2 text-indigo-500" />
                {t('divers.detail_sales')}
              </h3>
              <span className="text-xs text-base-content/60">{t('divers.transactions_found', {count: totalCount})}</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-base-300">
                <thead className="bg-base-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.date')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.invoice')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.product')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.lot')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.qty')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.unit_price')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.total')}</th>
                  </tr>
                </thead>
                <tbody className="bg-base-100 divide-y divide-base-200">
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={7} className="px-6 py-4"><div className="h-4 bg-base-200 rounded w-full"></div></td>
                      </tr>
                    ))
                  ) : ventes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-base-content/60">
                        {t('divers.no_sales_found')}
                      </td>
                    </tr>
                  ) : (
                    ventes.map((v) => (
                      <tr key={v.id} className="hover:bg-base-200 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content/70">
                          {v.date ? format(parseISO(v.date), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">
                          {v.facture_numero}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content">
                          {v.produit_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md text-xs font-medium">
                            {v.lot}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content text-right font-medium">
                          {v.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content/70 text-right">
                          {v.selling_price.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-primary text-right font-bold">
                          {v.total.toLocaleString()} F
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-base-200 flex items-center justify-between bg-base-200">
                <span className="text-sm text-base-content/60">
                  Page {page} / {totalPages} · {totalCount} {t('divers.results')}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-base-300 bg-base-100 hover:bg-base-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> {t('divers.previous')}
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-base-300 bg-base-100 hover:bg-base-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('divers.next')} <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'commandes' && (
        <div className="animate-fadeIn h-[calc(100vh-200px)]">
          <Commandes forcedType="DIV" />
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Valorisation Selector */}
          <div className="bg-base-100 p-6 rounded-xl shadow-sm border border-base-200">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-base-content">{t('divers.valuation_method')}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setValorisation('ACHAT')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    valorisation === 'ACHAT'
                      ? 'bg-primary text-white'
                      : 'bg-base-200 text-base-content hover:bg-base-300'
                  }`}
                >
                  {t('divers.purchase_cost')}
                </button>
                <button
                  onClick={() => setValorisation('VENTE')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    valorisation === 'VENTE'
                      ? 'bg-primary text-white'
                      : 'bg-base-200 text-base-content hover:bg-base-300'
                  }`}
                >
                  {t('divers.selling_price')}
                </button>
              </div>
            </div>
          </div>

          {stockLoading ? (
            <div className="bg-base-100 p-12 rounded-xl shadow-sm border border-base-200 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-base-content/60">{t('divers.loading_valuation')}</p>
            </div>
          ) : stockData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-primary p-6 rounded-xl shadow-md text-white">
                  <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-1">{t('divers.total_value_ttc')}</p>
                  <h2 className="text-3xl font-bold">{stockData.total_ttc.toLocaleString()} F</h2>
                  <p className="mt-2 text-indigo-100 text-xs">
                    {stockData.type_valorisation === 'PMP' ? t('divers.purchase_cost') : t('divers.selling_price')}
                  </p>
                </div>
                <div className="bg-base-100 p-6 rounded-xl shadow-sm border border-base-200">
                  <p className="text-base-content/60 text-sm font-medium uppercase tracking-wider mb-1">{t('divers.value_ht')}</p>
                  <h2 className="text-2xl font-bold text-base-content">{stockData.total_ht.toLocaleString()} F</h2>
                </div>
                <div className="bg-base-100 p-6 rounded-xl shadow-sm border border-base-200">
                  <p className="text-base-content/60 text-sm font-medium uppercase tracking-wider mb-1">{t('divers.total_vat')}</p>
                  <h2 className="text-2xl font-bold text-base-content">{stockData.total_tva.toLocaleString()} F</h2>
                </div>
              </div>

              {/* TVA Breakdown */}
              <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-base-200 bg-base-200">
                  <h3 className="font-semibold text-base-content flex items-center">
                    <ClipboardList className="h-5 w-5 mr-2 text-indigo-500" />
                    {t('divers.vat_breakdown')}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-base-300">
                    <thead className="bg-base-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.vat_rate')}</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.base_ht')}</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.vat_amount')}</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.total_ttc')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-base-100 divide-y divide-base-200">
                      {stockData.tva_breakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-base-200 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content font-medium">
                            {item.rate}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content/70 text-right">
                            {item.ht.toLocaleString()} F
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content/70 text-right">
                            {item.tva.toLocaleString()} F
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-primary text-right font-bold">
                            {item.ttc.toLocaleString()} F
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rayon Breakdown */}
              <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-base-200 bg-base-200">
                  <h3 className="font-semibold text-base-content flex items-center">
                    <Package className="h-5 w-5 mr-2 text-indigo-500" />
                    {t('divers.section_breakdown')}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-base-300">
                    <thead className="bg-base-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.section')}</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.base_ht')}</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.vat_amount')}</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-base-content/60 uppercase tracking-wider">{t('divers.table.total_ttc')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-base-100 divide-y divide-base-200">
                      {stockData.rayon_breakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-base-200 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content font-medium">
                            {item.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content/70 text-right">
                            {item.ht.toLocaleString()} F
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-base-content/70 text-right">
                            {item.tva.toLocaleString()} F
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-primary text-right font-bold">
                            {item.ttc.toLocaleString()} F
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-base-100 p-12 rounded-xl shadow-sm border border-base-200 text-center">
              <Warehouse className="h-12 w-12 text-base-content/40 mx-auto mb-4" />
              <p className="text-base-content/60">{t('divers.no_stock_data')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GestionDivers;
