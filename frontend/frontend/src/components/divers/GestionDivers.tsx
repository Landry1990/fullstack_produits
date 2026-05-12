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
  const { t } = useTranslation();
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Package className="h-8 w-8 mr-3 text-indigo-600" />
            {t('divers.title', 'Gestion Divers')}
          </h1>
          <p className="text-gray-500 mt-1">
            Gestion des produits importés (voyages) et dépôts après-vente
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-xl overflow-hidden shadow-sm">
        <button
          onClick={() => setActiveTab('ca')}
          className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
            activeTab === 'ca'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center">
            <DollarSign className="h-5 w-5 mr-2" />
            {t('divers.ca', 'CA Divers')}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('commandes')}
          className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
            activeTab === 'commandes'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center">
            <ShoppingBag className="h-5 w-5 mr-2" />
            {t('divers.commandes', 'Commandes Divers')}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('stock')}
          className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
            activeTab === 'stock'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center justify-center">
            <Warehouse className="h-5 w-5 mr-2" />
            {t('divers.stock', 'Stock Divers')}
          </div>
        </button>
      </div>

      {activeTab === 'ca' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Filters & Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[150px] flex items-center">
                <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                <input
                  type="date"
                  value={dateRange.debut}
                  onChange={(e) => setDateRange({ ...dateRange, debut: e.target.value })}
                  className="input input-bordered h-10 w-full sm:w-40 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <span className="text-gray-400 font-medium">à</span>
              <div className="flex-1 min-w-[150px] flex items-center">
                <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                <input
                  type="date"
                  value={dateRange.fin}
                  onChange={(e) => setDateRange({ ...dateRange, fin: e.target.value })}
                  className="input input-bordered h-10 w-full sm:w-40 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <button
                onClick={handleFilter}
                className="ml-auto inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtrer
              </button>
            </div>

            <div className="bg-indigo-600 p-6 rounded-xl shadow-md text-white">
              <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-1">Chiffre d'Affaires Total</p>
              <h2 className="text-3xl font-bold">{totalCA.toLocaleString()} F</h2>
              <div className="mt-4 flex items-center text-indigo-100 text-xs">
                <CalendarDays className="h-3 w-3 mr-1" />
                Période du {format(new Date(dateRange.debut), 'dd/MM/yy')} au {format(new Date(dateRange.fin), 'dd/MM/yy')}
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800 flex items-center">
                <ClipboardList className="h-5 w-5 mr-2 text-indigo-500" />
                Détail des ventes "Divers"
              </h3>
              <span className="text-xs text-gray-500">{totalCount} transactions trouvées</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facture</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lot</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qté</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">PU</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={7} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                      </tr>
                    ))
                  ) : ventes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                        Aucune vente "Divers" trouvée pour cette période.
                      </td>
                    </tr>
                  ) : (
                    ventes.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {v.date ? format(parseISO(v.date), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                          {v.facture_numero}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {v.produit_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md text-xs font-medium">
                            {v.lot}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                          {v.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {v.selling_price.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 text-right font-bold">
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
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                <span className="text-sm text-gray-500">
                  Page {page} / {totalPages} · {totalCount} résultats
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Suivant <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'commandes' && (
        <div className="animate-fadeIn h-[calc(100vh-280px)]">
          <Commandes forcedType="DIV" />
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Valorisation Selector */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">Méthode de valorisation :</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setValorisation('ACHAT')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    valorisation === 'ACHAT'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Coût d'achat (PMP)
                </button>
                <button
                  onClick={() => setValorisation('VENTE')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    valorisation === 'VENTE'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Prix de vente
                </button>
              </div>
            </div>
          </div>

          {stockLoading ? (
            <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">Chargement de la valorisation...</p>
            </div>
          ) : stockData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-indigo-600 p-6 rounded-xl shadow-md text-white">
                  <p className="text-indigo-100 text-sm font-medium uppercase tracking-wider mb-1">Valeur Totale TTC</p>
                  <h2 className="text-3xl font-bold">{stockData.total_ttc.toLocaleString()} F</h2>
                  <p className="mt-2 text-indigo-100 text-xs">
                    {stockData.type_valorisation === 'PMP' ? 'Valorisation au coût d\'achat' : 'Valorisation au prix de vente'}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <p className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-1">Valeur HT</p>
                  <h2 className="text-2xl font-bold text-gray-900">{stockData.total_ht.toLocaleString()} F</h2>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <p className="text-gray-500 text-sm font-medium uppercase tracking-wider mb-1">TVA Totale</p>
                  <h2 className="text-2xl font-bold text-gray-900">{stockData.total_tva.toLocaleString()} F</h2>
                </div>
              </div>

              {/* TVA Breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-semibold text-gray-800 flex items-center">
                    <ClipboardList className="h-5 w-5 mr-2 text-indigo-500" />
                    Répartition par taux de TVA
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taux TVA</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Base HT</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant TVA</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {stockData.tva_breakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {item.rate}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                            {item.ht.toLocaleString()} F
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                            {item.tva.toLocaleString()} F
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 text-right font-bold">
                            {item.ttc.toLocaleString()} F
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rayon Breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-semibold text-gray-800 flex items-center">
                    <Package className="h-5 w-5 mr-2 text-indigo-500" />
                    Répartition par rayon
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rayon</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Base HT</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant TVA</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total TTC</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {stockData.rayon_breakdown.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            {item.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                            {item.ht.toLocaleString()} F
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                            {item.tva.toLocaleString()} F
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 text-right font-bold">
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
            <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-100 text-center">
              <Warehouse className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucune donnée de stock divers disponible</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GestionDivers;
