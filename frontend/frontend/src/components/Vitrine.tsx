import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Search, Globe, DollarSign, Cloud, ShoppingCart, CheckCircle, XCircle, Trash2 } from 'lucide-react';

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
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    // Clear selection when search changes or products refresh significantly
    useEffect(() => {
        setSelectedIds([]);
    }, [searchTerm, showPublicOnly]);

    const toggleSelection = (id: number) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        );
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(products.map((p: Product) => p.id));
        } else {
            setSelectedIds([]);
        }
    };

    const isAllSelected = products.length > 0 && selectedIds.length === products.length;

    return (
        <div className="space-y-6 relative">
             {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center bg-base-100 p-4 rounded-lg shadow">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Rechercher un produit à gérer..." 
                        className="input input-bordered w-full pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="form-control">
                    <label className="label cursor-pointer gap-2 justify-start lg:justify-center">
                        <span className="label-text font-medium">Uniquement visibles</span> 
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
            {selectedIds.length > 0 && (
                <div className="alert bg-base-100 shadow-lg border-l-4 border-primary flex flex-col sm:flex-row justify-between items-center gap-4 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-primary" />
                        <span className="font-semibold">{selectedIds.length} produit(s) sélectionné(s)</span>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            className="btn btn-sm btn-success text-white"
                            onClick={() => {
                                bulkToggle.mutate({ ids: selectedIds, target_status: true });
                                setSelectedIds([]);
                            }}
                        >
                            Mettre en ligne
                        </button>
                        <button 
                            className="btn btn-sm btn-error text-white"
                            onClick={() => {
                                bulkToggle.mutate({ ids: selectedIds, target_status: false });
                                setSelectedIds([]);
                            }}
                        >
                            Retirer de la vitrine
                        </button>
                         <button 
                            className="btn btn-sm btn-ghost"
                            onClick={() => setSelectedIds([])}
                        >
                            Annuler
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
                    <th>Produit</th>
                    <th>Rayon</th>
                    <th>Stock</th>
                    <th>Prix Officine</th>
                    <th>Prix Public (Web)</th>
                    <th className="text-center">En Ligne ?</th>
                    </tr>
                </thead>
                <tbody>
                    {isLoading ? (
                    <tr><td colSpan={7} className="text-center p-8"><span className="loading loading-spinner loading-lg"></span></td></tr>
                    ) : products.length === 0 ? (
                        <tr><td colSpan={7} className="text-center p-8 text-gray-500">Aucun produit trouvé</td></tr>
                    ) : (
                        products.map((product: Product) => (
                            <tr key={product.id} className={`hover:bg-base-50 ${selectedIds.includes(product.id) ? 'bg-base-200' : ''}`}>
                                <td>
                                    <input 
                                        type="checkbox" 
                                        className="checkbox checkbox-sm"
                                        checked={selectedIds.includes(product.id)}
                                        onChange={() => toggleSelection(product.id)}
                                    />
                                </td>
                                <td>
                                    <div className="font-bold whitespace-nowrap">{product.name}</div>
                                    <div className="text-xs text-gray-400">{product.cip1}</div>
                                </td>
                                <td>
                                    <span className="badge badge-ghost badge-sm whitespace-nowrap">{product.rayon_name || 'Non classé'}</span>
                                </td>
                                <td>
                                    <div className={`font-mono font-medium ${product.stock <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                                        {product.stock}
                                    </div>
                                </td>
                                <td className="font-mono whitespace-nowrap">
                                    {product.selling_price?.toLocaleString('fr-FR')} FCFA
                                </td>
                                <td>
                                    <div className="join">
                                        <span className="join-item btn btn-sm btn-ghost no-animation">
                                            <DollarSign className="w-4 h-4" />
                                        </span>
                                        <input 
                                            type="number" 
                                            className="join-item input input-sm input-bordered w-24 lg:w-32 font-mono"
                                            placeholder={product.selling_price?.toString()} 
                                            defaultValue={product.public_price || ''}
                                            onBlur={(e) => {
                                                const val = e.target.value ? parseFloat(e.target.value) : null;
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
             
             const response = await axios.get('/api/produits/', { params });
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
            toast.error("Produit déjà dans la liste");
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
                        <Search className="w-6 h-6 text-primary" />
                        Rechercher un médicament
                    </h2>
                    <input 
                        type="text" 
                        placeholder="Ex: Doliprane, Paracétamol..." 
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
                                                        <span className="badge badge-success badge-sm text-white gap-1"><CheckCircle className="w-3 h-3"/> Dispo</span>
                                                    ) : (
                                                        <span className="badge badge-error badge-sm text-white gap-1"><XCircle className="w-3 h-3"/> Rupture</span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {debouncedSearch && results.length === 0 && !isLoading && (
                            <div className="alert">Aucun produit disponible trouvé.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Colonne "Panier" / Disponibilité */}
            <div className="lg:col-span-1 order-2 lg:order-none">
                <div className="card bg-base-100 shadow-xl h-full border-t-4 border-primary sticky top-4 lg:static">
                    <div className="card-body p-4 lg:p-8">
                        <h2 className="card-title flex justify-between">
                            <span>Ma Liste</span>
                            <div className="indicator">
                                <span className="indicator-item badge badge-secondary">{cart.length}</span> 
                                <ShoppingCart className="w-6 h-6" />
                            </div>
                        </h2>
                        
                        <div className="divider my-2"></div>

                        <div className="space-y-4 overflow-y-auto max-h-[300px] lg:max-h-[500px]">
                            {cart.length === 0 ? (
                                <div className="text-center text-gray-400 py-10">
                                    <ShoppingCart className="w-16 h-16 mx-auto mb-2 opacity-20" />
                                    Votre liste est vide
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
                                                        <CheckCircle className="w-2 h-2" /> Disponible
                                                    </span>
                                                ) : (
                                                    <span className="badge badge-error gap-1 text-white text-xs">
                                                        <XCircle className="w-2 h-2" /> Rupture
                                                    </span>
                                                )}
                                                
                                                <span className="font-mono text-sm opacity-70">
                                                    {(item.public_price || item.selling_price)?.toLocaleString()} FCFA
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => removeFromCart(item.id)}
                                            className="btn btn-ghost btn-sm text-error opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="w-4 h-4" />
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
      const response = await axios.get('/api/produits/', { params: { is_public: 'true', page_size: 1 } });
      return response.data.count || 0;
    }
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['vitrine-products', debouncedSearch, showPublicOnly],
    queryFn: async () => {
      const params: any = { search: debouncedSearch };
      if (showPublicOnly) params.is_public = 'true';
      const response = await axios.get('/api/produits/', { params });
      return response.data.results || response.data;
    },
    enabled: activeTab === 'gestion' // Ne charger que si on est sur l'onglet gestion
  });

  const toggleVisibility = useMutation({
    mutationFn: async (id: number) => {
      await axios.post(`/api/produits/${id}/toggle_public/`);
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
    onError: (_err, _newTodo, context) => { // Keeping for context if needed, or remove args
        queryClient.setQueryData(['vitrine-products', debouncedSearch, showPublicOnly], context?.previousProducts);
        toast.error("Erreur lors de la mise à jour");
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['vitrine-products'] });
        queryClient.invalidateQueries({ queryKey: ['vitrine-stats-count'] });
    },
    onSuccess: () => {
      toast.success('Visibilité mise à jour');
    }
  });

  const updatePrice = useMutation({
    mutationFn: async ({ id, price }: { id: number, price: number | null }) => {
      await axios.patch(`/api/produits/${id}/`, { public_price: price });
    },
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['vitrine-products'] });
        toast.success('Prix mis à jour');
    },
    onError: () => toast.error("Erreur")
  });

  const bulkToggle = useMutation({
    mutationFn: async ({ ids, target_status }: { ids: number[], target_status: boolean }) => {
      await axios.post(`/api/produits/bulk_toggle_public/`, { ids, target_status });
    },
    onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['vitrine-products'] });
        queryClient.invalidateQueries({ queryKey: ['vitrine-stats-count'] });
        toast.success(variables.target_status ? 'Produits mis en ligne' : 'Produits retirés de la vitrine');
    },
    onError: () => toast.error("Erreur lors de la mise à jour en masse")
  });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 lg:w-8 lg:h-8 text-blue-500" />
            Ma Vitrine en Ligne
          </h1>
          <p className="text-sm lg:text-base text-gray-500 mt-1">Gérez votre présence web et simulez l'expérience patient</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch lg:items-center gap-4 lg:gap-6">
             <div className="bg-base-100 shadow rounded-lg p-3 flex items-center gap-3 border border-base-200">
                <div className="p-2 bg-primary/10 rounded-full text-primary">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Produits en ligne</div>
                  <div className="text-xl font-bold leading-none">
                      {publicCount}
                  </div>
                </div>
             </div>
        
            <div className="tabs tabs-boxed w-full sm:w-auto">
                <a 
                    className={`tab flex-1 sm:flex-none ${activeTab === 'gestion' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('gestion')}
                >
                    Gestion
                </a>
                <a 
                    className={`tab flex-1 sm:flex-none ${activeTab === 'simulateur' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('simulateur')}
                >
                    Simulateur
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
