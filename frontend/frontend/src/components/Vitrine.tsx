import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { Search, Globe, DollarSign, Cloud, ShoppingCart, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { formatCurrency, normalizeNumberInput, formatNumber } from '../utils/formatters';

interface Product {
  id: number;
  name: string;
  cip1: string;
  stock: number;
  selling_price: number;
  is_public: boolean;
  public_price: number | null;
  rayon_name?: string;
}

// --- Composant Gestion (Admin) ---
function GestionVitrine({ products, isLoading, searchTerm, setSearchTerm, showPublicOnly, setShowPublicOnly, toggleVisibility, updatePrice, bulkToggle }: any) {
    const { t } = useTranslation(['vitrine', 'common']);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // Clear selection when search changes or products refresh significantly
    useEffect(() => {
        setSelectedIds(new Set());
    }, [searchTerm, showPublicOnly]);

    const toggleSelection = (id: number) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(products.map((p: Product) => p.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const isAllSelected = products.length > 0 && selectedIds.size === products.length;

    return (
        <div className="space-y-6 relative">
             {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center bg-base-100 p-4 rounded-lg shadow">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-base-content/40" />
                    <input 
                        type="text" 
                        placeholder={t('gestion.search_placeholder')}
                        className="input input-bordered w-full pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="form-control">
                    <label className="label cursor-pointer gap-2 justify-start lg:justify-center">
                        <span className="label-text font-medium">{t('gestion.show_public_only')}</span> 
                        <input 
                            type="checkbox" 
                            className="toggle toggle-primary" 
                            checked={showPublicOnly}
                            onChange={(e) => setShowPublicOnly(e.target.checked)}
                        />
                    </label>
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="alert bg-base-100 shadow-lg border-l-4 border-primary flex flex-col sm:flex-row justify-between items-center gap-4 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="size-5 text-primary" />
                        <span className="font-semibold">{t('gestion.selected_count', { count: selectedIds.size })}</span>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            className="btn btn-sm btn-success text-white"
                            onClick={() => {
                                bulkToggle.mutate({ ids: Array.from(selectedIds), target_status: true });
                                setSelectedIds(new Set());
                            }}
                        >
                            {t('gestion.publish')}
                        </button>
                        <button 
                            className="btn btn-sm btn-error text-white"
                            onClick={() => {
                                bulkToggle.mutate({ ids: Array.from(selectedIds), target_status: false });
                                setSelectedIds(new Set());
                            }}
                        >
                            {t('gestion.unpublish')}
                        </button>
                         <button 
                            className="btn btn-sm btn-ghost"
                            onClick={() => setSelectedIds(new Set())}
                        >
                            {t('gestion.cancel')}
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto bg-base-100 rounded-lg shadow">
                <table className="table min-w-[800px] lg:min-w-full">
                <thead>
                    <tr className="bg-base-200">
                    <th className="w-10">
                        <input 
                            type="checkbox" 
                            className="checkbox checkbox-sm"
                            checked={isAllSelected}
                            onChange={handleSelectAll}
                            disabled={isLoading || products.length === 0}
                        />
                    </th>
                    <th>{t('gestion.table.product')}</th>
                    <th>{t('gestion.table.rayon')}</th>
                    <th>{t('gestion.table.stock')}</th>
                    <th>{t('gestion.table.pharmacy_price')}</th>
                    <th>{t('gestion.table.public_price')}</th>
                    <th className="text-center">{t('gestion.table.online')}</th>
                    </tr>
                </thead>
                <tbody>
                    {isLoading ? (
                    <tr><td colSpan={7} className="text-center p-8"><span className="loading loading-spinner loading-lg"></span></td></tr>
                    ) : products.length === 0 ? (
                        <tr><td colSpan={7} className="text-center p-8 text-base-content/60">{t('gestion.table.empty')}</td></tr>
                    ) : (
                        products.map((product: Product) => (
                            <tr key={product.id} className={`hover:bg-base-50 ${selectedIds.has(product.id) ? 'bg-base-200' : ''}`}>
                                <td>
                                    <input 
                                        type="checkbox" 
                                        className="checkbox checkbox-sm"
                                        checked={selectedIds.has(product.id)}
                                        onChange={() => toggleSelection(product.id)}
                                    />
                                </td>
                                <td>
                                    <div className="font-bold whitespace-nowrap">{product.name}</div>
                                    <div className="text-xs text-base-content/40">{product.cip1}</div>
                                </td>
                                <td>
                                    <span className="badge badge-ghost badge-sm whitespace-nowrap">{product.rayon_name || t('gestion.table.uncategorized')}</span>
                                </td>
                                <td>
                                    <div className={`font-mono font-medium ${product.stock <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                                        {formatNumber(product.stock)}
                                    </div>
                                </td>
                                <td className="font-mono whitespace-nowrap">
                                    {formatCurrency(product.selling_price)}
                                </td>
                                <td>
                                    <div className="join">
                                        <span className="join-item btn btn-sm btn-ghost no-animation">
                                            <DollarSign className="size-4" />
                                        </span>
                                        <input 
                                            type="number" 
                                            className="join-item input input-sm input-bordered w-24 lg:w-32 font-mono"
                                            placeholder={product.selling_price?.toString()} 
                                            defaultValue={product.public_price || ''}
                                            onBlur={(e) => {
                                                const val = e.target.value ? normalizeNumberInput(e.target.value) : null;
                                                if (val !== product.public_price) {
                                                    updatePrice.mutate({ id: product.id, price: val });
                                                }
                                            }}
                                        />
                                    </div>
                                </td>
                                <td className="text-center">
                                    <input 
                                        type="checkbox" 
                                        className={`toggle ${product.is_public ? 'toggle-success' : 'toggle-error'}`}
                                        checked={product.is_public}
                                        onChange={() => toggleVisibility.mutate(product.id)}
                                    />
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
                </table>
            </div>
        </div>
    );
}

// --- Composant Simulateur (Client) ---
function SimulateurClient() {
    const { t } = useTranslation(['vitrine', 'common']);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [cart, setCart] = useState<Product[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        // Reset highlight when search changes
        setHighlightedIndex(-1);
    }, [debouncedSearch]);

    // Fetch ONLY public products for simulation
    const { data: results = [], isLoading } = useQuery({
        queryKey: ['vitrine-simulation', debouncedSearch],
        queryFn: async () => {
             // Si pas de recherche, on affiche les 20 premiers produits publics
             const params: any = { is_public: 'true' };
             if (debouncedSearch) {
                 params.search = debouncedSearch;
             } else {
                 params.page_size = 20; // Limit default view
             }
             
             const response = await api.get('produits/', { params });
             return response.data.results || response.data;
        },
        // Always enabled now
    });

    const addToCart = (product: Product) => {
        if (!cart.find(p => p.id === product.id)) {
            setCart([...cart, product]);
            setSearchTerm(''); // Clear search after add
            setHighlightedIndex(-1);
        } else {
            toast.error(t('simulateur.already_in_list'));
        }
    };

    const removeFromCart = (id: number) => {
        setCart(cart.filter(p => p.id !== id));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.min(prev + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightedIndex >= 0 && results[highlightedIndex]) {
                addToCart(results[highlightedIndex]);
            }
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-[calc(100vh-200px)]">
            {/* Colonne Recherche */}
            <div className="lg:col-span-2 space-y-4 order-1 lg:order-none">
                <div className="card bg-base-100 shadow-lg p-4 lg:p-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Search className="size-6 text-primary" />
                        {t('simulateur.search_title')}
                    </h2>
                    <input 
                        type="text" 
                        placeholder={t('simulateur.search_placeholder')}
                        className="input input-bordered input-lg w-full text-lg"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                    
                    {/* Résultats de recherche */}
                    <div className="mt-4 space-y-2">
                        {isLoading && <div className="text-center p-4"><span className="loading loading-spinner"></span></div>}
                        
                        {results.length > 0 && (
                            <ul className="menu bg-base-200 rounded-box p-2">
                                {results.map((p: Product, index: number) => (
                                    <li key={p.id}>
                                        <button 
                                            onClick={() => addToCart(p)} 
                                            className={`flex justify-between py-3 ${index === highlightedIndex ? 'active' : ''}`}
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                        >
                                            <div className="text-left w-full">
                                                <div className="font-bold text-lg">{p.name}</div>
                                                <div className="flex flex-wrap gap-2 items-center mt-1">
                                                    <div className="text-sm opacity-60">{p.cip1}</div>
                                                    {/* Statut Stock dans les résultats */}
                                                    {p.stock > 0 ? (
                                                        <span className="badge badge-success badge-sm text-white gap-1"><CheckCircle className="size-3"/>{t('simulateur.available')}</span>
                                                    ) : (
                                                        <span className="badge badge-error badge-sm text-white gap-1"><XCircle className="size-3"/>{t('simulateur.out_of_stock')}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {debouncedSearch && results.length === 0 && !isLoading && (
                            <div className="alert">{t('simulateur.no_results')}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Colonne "Panier" / Disponibilité */}
            <div className="lg:col-span-1 order-2 lg:order-none">
                <div className="card bg-base-100 shadow-xl h-full border-t-4 border-primary sticky top-4 lg:static">
                    <div className="card-body p-4 lg:p-8">
                        <h2 className="card-title flex justify-between">
                            <span>{t('simulateur.my_list')}</span>
                            <div className="indicator">
                                <span className="indicator-item badge badge-secondary">{cart.length}</span> 
                                <ShoppingCart className="size-6" />
                            </div>
                        </h2>
                        
                        <div className="divider my-2"></div>

                        <div className="space-y-4 overflow-y-auto max-h-[300px] lg:max-h-[500px]">
                            {cart.length === 0 ? (
                                <div className="text-center text-base-content/40 py-10">
                                    <ShoppingCart className="size-16 mx-auto mb-2 opacity-20" />
                                    {t('simulateur.empty_list')}
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} className="flex justify-between items-center bg-base-200 p-3 rounded-lg group animate-in fade-in slide-in-from-right-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{item.name}</div>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                {/* Logique de disponibilité simplifiée pour le client */}
                                                {item.stock > 0 ? (
                                                    <span className="badge badge-success gap-1 text-white text-xs">
                                                        <CheckCircle className="size-2" /> {t('simulateur.available_full')}
                                                    </span>
                                                ) : (
                                                    <span className="badge badge-error gap-1 text-white text-xs">
                                                        <XCircle className="size-2" /> {t('simulateur.out_of_stock')}
                                                    </span>
                                                )}
                                                
                                                <span className="font-mono text-sm opacity-70">
                                                    {formatCurrency(normalizeNumberInput(item.public_price || item.selling_price))}
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => removeFromCart(item.id)}
                                            className="btn btn-ghost btn-sm text-error opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Composant Principal ---
export default function Vitrine() {
  const { t } = useTranslation(['vitrine', 'common']);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'gestion' | 'simulateur'>('gestion');
  
  // State pour la gestion
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showPublicOnly, setShowPublicOnly] = useState<boolean>(false);

  // Debounce global pour l'onglet gestion
  useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch stats (count of public products)
  const { data: publicCount = 0 } = useQuery({
    queryKey: ['vitrine-stats-count'],
    queryFn: async () => {
      const response = await api.get('produits/', { params: { is_public: 'true', page_size: 1 } });
      return response.data.count || 0;
    }
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['vitrine-products', debouncedSearch, showPublicOnly],
    queryFn: async () => {
      const params: any = { search: debouncedSearch };
      if (showPublicOnly) params.is_public = 'true';
      const response = await api.get('produits/', { params });
      return response.data.results || response.data;
    },
    enabled: activeTab === 'gestion' // Ne charger que si on est sur l'onglet gestion
  });

  const toggleVisibility = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`produits/${id}/toggle_public/`);
    },
    onMutate: async (id) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries({ queryKey: ['vitrine-products'] });

        // Snapshot previous value
        const previousProducts = queryClient.getQueryData(['vitrine-products']);

        // Optimistically update
        queryClient.setQueryData(['vitrine-products', debouncedSearch, showPublicOnly], (old: any) => {
            if (!old) return old;
            const list = Array.isArray(old) ? old : old.results;
            const updatedList = list.map((p: Product) => p.id === id ? { ...p, is_public: !p.is_public } : p);
            return Array.isArray(old) ? updatedList : { ...old, results: updatedList };
        });

        return { previousProducts };
    },
    onError: (_err, _newTodo, context) => {
        queryClient.setQueryData(['vitrine-products', debouncedSearch, showPublicOnly], context?.previousProducts);
        toast.error(t('messages.update_error'));
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['vitrine-products'] });
        queryClient.invalidateQueries({ queryKey: ['vitrine-stats-count'] });
    },
    onSuccess: () => {
      toast.success(t('messages.visibility_updated'));
    }
  });

  const updatePrice = useMutation({
    mutationFn: async ({ id, price }: { id: number, price: number | null }) => {
      await api.patch(`produits/${id}/`, { public_price: price });
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['vitrine-products'] });
        toast.success(t('messages.price_updated'));
    },
    onError: () => toast.error(t('messages.generic_error'))
  });

  const bulkToggle = useMutation({
    mutationFn: async ({ ids, target_status }: { ids: number[], target_status: boolean }) => {
      await api.post('produits/bulk_toggle_public/', { ids, target_status });
    },
    onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['vitrine-products'] });
        queryClient.invalidateQueries({ queryKey: ['vitrine-stats-count'] });
        toast.success(variables.target_status ? t('messages.bulk_published') : t('messages.bulk_unpublished'));
    },
    onError: () => toast.error(t('messages.bulk_error'))
  });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Globe className="size-6 lg:w-8 lg:h-8 text-blue-500" />
            {t('title')}
          </h1>
          <p className="text-sm lg:text-base text-base-content/60 mt-1">{t('subtitle')}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch lg:items-center gap-4 lg:gap-6">
             <div className="bg-base-100 shadow rounded-lg p-3 flex items-center gap-3 border border-base-200">
                <div className="p-2 bg-primary/10 rounded-full text-primary">
                  <Cloud className="size-5" />
                </div>
                <div>
                  <div className="text-xs text-base-content/60 font-medium uppercase tracking-wider">{t('online_count')}</div>
                  <div className="text-xl font-bold leading-none">
                      {formatNumber(publicCount)}
                  </div>
                </div>
             </div>
        
            <div className="tabs tabs-boxed w-full sm:w-auto">
                <a 
                    className={`tab flex-1 sm:flex-none ${activeTab === 'gestion' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('gestion')}
                >
                    {t('tabs.gestion')}
                </a>
                <a 
                    className={`tab flex-1 sm:flex-none ${activeTab === 'simulateur' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('simulateur')}
                >
                    {t('tabs.simulateur')}
                </a>
            </div>
        </div>
      </div>

      {activeTab === 'gestion' ? (
          <GestionVitrine 
            products={products}
            isLoading={isLoading}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            showPublicOnly={showPublicOnly}
            setShowPublicOnly={setShowPublicOnly}
            toggleVisibility={toggleVisibility}
            updatePrice={updatePrice}
            bulkToggle={bulkToggle}
          />
      ) : (
          <SimulateurClient />
      )}
    </div>
  );
}
