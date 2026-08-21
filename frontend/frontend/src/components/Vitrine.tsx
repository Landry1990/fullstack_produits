import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { gooeyToast } from 'goey-toast';
import {
  Search,
  Globe,
  DollarSign,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  EyeOff,
  Package,
  Plus,
  Printer,
  RotateCcw,
} from 'lucide-react';
import { formatCurrency, normalizeNumberInput, formatNumber } from '../utils/formatters';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Checkbox } from './ui/Checkbox';
import { Tabs, TabsList, TabsTrigger } from './ui/Tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/Table';

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

interface GestionVitrineProps {
  products: Product[];
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  showPublicOnly: boolean;
  setShowPublicOnly: (value: boolean) => void;
  toggleVisibility: { mutate: (id: number) => void };
  updatePrice: { mutate: (args: { id: number; price: number | null }) => void };
  bulkToggle: { mutate: (args: { ids: number[]; target_status: boolean }) => void };
}

// --- Composant Gestion (Admin) ---
function GestionVitrine({
  products,
  isLoading,
  searchTerm,
  setSearchTerm,
  showPublicOnly,
  setShowPublicOnly,
  toggleVisibility,
  updatePrice,
  bulkToggle,
}: GestionVitrineProps) {
  const { t } = useTranslation(['vitrine', 'common']);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchTerm, showPublicOnly]);

  const toggleSelection = (id: number) => {
    setSelectedIds((prev: Set<number>) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(products.map((p: Product) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const isAllSelected = products.length > 0 && selectedIds.size === products.length;

  return (
    <div className="space-y-6 relative">
      {/* Filters */}
      <Card variant="elevated" padding="md" className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-base-content/40" />
          <Input
            type="text"
            placeholder={t('gestion.search_placeholder')}
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 bg-base-200/50 rounded-lg px-4 py-2">
          <Checkbox
            checked={showPublicOnly}
            onChange={(checked) => setShowPublicOnly(checked)}
            label={t('gestion.show_public_only')}
          />
        </div>
      </Card>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card
          variant="bordered"
          padding="sm"
          className="flex flex-col sm:flex-row justify-between items-center gap-4 animate-in slide-in-from-top-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="size-5 text-primary" />
            <span className="font-semibold text-sm">
              {t('gestion.selected_count', { count: selectedIds.size })}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Eye className="size-3.5" />}
              onClick={() => {
                bulkToggle.mutate({ ids: Array.from(selectedIds), target_status: true });
                setSelectedIds(new Set());
              }}
            >
              {t('gestion.publish')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              leftIcon={<EyeOff className="size-3.5" />}
              onClick={() => {
                bulkToggle.mutate({ ids: Array.from(selectedIds), target_status: false });
                setSelectedIds(new Set());
              }}
            >
              {t('gestion.unpublish')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              {t('gestion.cancel')}
            </Button>
          </div>
        </Card>
      )}

      {/* Table */}
      <Card variant="default" padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 px-3 py-2 text-center">
                  <Checkbox
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    disabled={isLoading || products.length === 0}
                  />
                </TableHead>
                <TableHead className="w-[30%] px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('gestion.table.product')}</TableHead>
                <TableHead className="w-28 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('gestion.table.rayon')}</TableHead>
                <TableHead className="w-20 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('gestion.table.stock')}</TableHead>
                <TableHead className="w-28 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('gestion.table.pharmacy_price')}</TableHead>
                <TableHead className="w-28 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">{t('gestion.table.public_price')}</TableHead>
                <TableHead className="w-20 px-3 py-2 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500 text-center">{t('gestion.table.online')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-3 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-3 py-12 text-center text-base-content/60">
                    {t('gestion.table.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product: Product) => (
                  <TableRow
                    key={product.id}
                    className={selectedIds.has(product.id) ? 'bg-base-200' : ''}
                  >
                    <TableCell className="px-3 py-2 text-center">
                      <Checkbox
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelection(product.id)}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="font-bold whitespace-nowrap text-sm">{product.name}</div>
                      <div className="text-xs text-base-content/40">{product.cip1}</div>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <Badge variant="ghost" size="sm">
                        {product.rayon_name || t('gestion.table.uncategorized')}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <div
                        className={`font-mono font-medium text-sm ${
                          product.stock <= 0 ? 'text-red-500' : 'text-emerald-600'
                        }`}
                      >
                        {formatNumber(product.stock)}
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 font-mono whitespace-nowrap text-sm">
                      {formatCurrency(product.selling_price)}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="text-base-content/40">
                          <DollarSign className="size-3.5" />
                        </span>
                        <input
                          type="number"
                          className="h-8 w-24 lg:w-32 rounded-md border border-base-300 bg-base-100 px-2 text-sm font-mono focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                          placeholder={product.selling_price?.toString()}
                          defaultValue={product.public_price || ''}
                          onBlur={(e) => {
                            const val = e.target.value
                              ? normalizeNumberInput(e.target.value)
                              : null;
                            if (val !== product.public_price) {
                              updatePrice.mutate({ id: product.id, price: val });
                            }
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-center">
                      <button
                        onClick={() => toggleVisibility.mutate(product.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                          product.is_public ? 'bg-emerald-500' : 'bg-base-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            product.is_public ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

// --- Composant Simulateur (Client) ---
interface CartItem extends Product {
  quantity: number;
}

const getUnitPrice = (product: Product) =>
  normalizeNumberInput(product.public_price || product.selling_price);

const handlePrint = () => {
  window.print();
};

// --- Composant Simulateur (Client) ---
function SimulateurClient() {
  const { t } = useTranslation(['vitrine', 'common']);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [debouncedSearch]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['vitrine-simulation', debouncedSearch],
    queryFn: async () => {
      const params: Record<string, string | number> = { is_public: 'true' };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      } else {
        params.page_size = 20;
      }
      const response = await api.get('produits/', { params });
      return response.data.results || response.data;
    },
  });

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) {
        return prev.map((p) => (p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p));
      }
      gooeyToast.success(t('simulateur.added_to_list'), { duration: 1500 });
      return [...prev, { ...product, quantity: 1 }];
    });
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    gooeyToast.success(t('simulateur.list_cleared'), { duration: 1500 });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev.reduce<CartItem[]>((acc, p) => {
        const updated = p.id === id ? { ...p, quantity: Math.max(1, p.quantity + delta) } : p;
        if (updated.quantity > 0) {
          acc.push(updated);
        }
        return acc;
      }, [])
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + getUnitPrice(item) * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && results[highlightedIndex]) {
        addToCart(results[highlightedIndex]);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto lg:h-full">
      {/* Colonne Recherche */}
      <div className="lg:col-span-2 space-y-4 order-1 lg:order-none">
        <Card variant="elevated" padding="lg">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Search className="size-6 text-primary" />
            {t('simulateur.search_title')}
          </h2>
          <Input
            type="text"
            placeholder={t('simulateur.search_placeholder')}
            className="text-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            icon={<Search className="size-5" />}
          />

          {/* Résultats de recherche */}
          <div className="mt-4 space-y-2">
            {isLoading && (
              <div className="text-center py-6">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            )}

            {results.length > 0 && (
              <div className="bg-base-200/50 rounded-xl p-2 space-y-1">
                {results.map((p: Product, index: number) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`w-full flex justify-between items-center py-3 px-4 rounded-lg transition-all text-left gap-3 ${
                      index === highlightedIndex
                        ? 'bg-primary text-primary-content shadow-md'
                        : 'hover:bg-base-100'
                    }`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="text-left flex-1 min-w-0">
                      <div className={`font-bold text-base truncate ${index === highlightedIndex ? 'text-primary-content' : 'text-base-content'}`}>
                        {p.name}
                      </div>
                      <div className="flex flex-wrap gap-2 items-center mt-1">
                        <div className={`text-sm opacity-70 ${index === highlightedIndex ? 'text-primary-content/80' : ''}`}>
                          {p.cip1}
                        </div>
                        {p.stock > 0 ? (
                          <Badge variant="success" size="sm">
                            <CheckCircle className="size-3 mr-1" />
                            {t('simulateur.available')}
                          </Badge>
                        ) : (
                          <Badge variant="error" size="sm">
                            <XCircle className="size-3 mr-1" />
                            {t('simulateur.out_of_stock')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-bold font-mono ${index === highlightedIndex ? 'text-primary-content' : 'text-emerald-600'}`}>
                        {formatCurrency(getUnitPrice(p))}
                      </div>
                      <div className={`text-xs ${index === highlightedIndex ? 'text-primary-content/80' : 'text-base-content/40'}`}>
                        {t('simulateur.public_price')}
                      </div>
                    </div>
                    <div className={`shrink-0 p-1.5 rounded-full ${index === highlightedIndex ? 'bg-primary-content/20' : 'bg-primary/10 text-primary'}`}>
                      <Plus className="size-4" />
                    </div>
                  </button>
                ))}
              </div>
            )}
            {debouncedSearch && results.length === 0 && !isLoading && (
              <Card variant="bordered" padding="md" className="text-center text-base-content/60">
                {t('simulateur.no_results')}
              </Card>
            )}
          </div>
        </Card>
      </div>

      {/* Colonne "Panier" */}
      <div className="lg:col-span-1 order-2 lg:order-none">
        <Card variant="elevated" className="h-full sticky top-4 overflow-hidden flex flex-col" padding="none">
          <div className="bg-primary/5 p-5 border-b border-primary/10">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-bold text-base">{t('simulateur.my_list')}</span>
                {cart.length > 0 && (
                  <div className="text-xs text-base-content/60 mt-0.5">
                    {cartCount} {cartCount > 1 ? t('simulateur.items') : t('simulateur.item')}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-2">
                  <div className="text-xs text-base-content/60 uppercase tracking-wide">{t('simulateur.total')}</div>
                  <div className="text-lg font-bold font-mono text-emerald-600 leading-none">{formatCurrency(cartTotal)}</div>
                </div>
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <ShoppingCart className="size-5" />
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 bg-base-100 flex-1 flex flex-col">
            <div className="space-y-3 overflow-y-auto max-h-[300px] lg:max-h-[500px] pr-1 flex-1">
              {cart.length === 0 ? (
                <div className="text-center text-base-content/40 py-10 flex flex-col items-center h-full justify-center">
                  <div className="h-16 w-16 rounded-2xl bg-base-200 flex items-center justify-center mx-auto mb-3">
                    <ShoppingCart className="size-8 text-base-content/20" />
                  </div>
                  <p className="text-sm font-medium">{t('simulateur.empty_list')}</p>
                  <p className="text-xs mt-1 max-w-[200px]">{t('simulateur.empty_list_hint')}</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center bg-base-200/70 p-3 rounded-xl group animate-in fade-in slide-in-from-right-4 gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-sm">{item.name}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {item.stock > 0 ? (
                          <Badge variant="success" size="sm">
                            <CheckCircle className="size-2.5 mr-1" />
                            {t('simulateur.available_full')}
                          </Badge>
                        ) : (
                          <Badge variant="error" size="sm">
                            <XCircle className="size-2.5 mr-1" />
                            {t('simulateur.out_of_stock')}
                          </Badge>
                        )}
                        <span className="font-mono text-sm text-base-content/70">
                          {formatCurrency(getUnitPrice(item))}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 min-w-0"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        −
                      </Button>
                      <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 min-w-0"
                        onClick={() => updateQuantity(item.id, +1)}
                      >
                        +
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromCart(item.id)}
                      className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity text-error hover:bg-red-50 shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="mt-4 pt-4 border-t border-base-200 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-base-content/60">{t('simulateur.total')}</span>
                  <span className="text-xl font-bold font-mono text-emerald-600">{formatCurrency(cartTotal)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Printer className="size-4" />}
                    onClick={handlePrint}
                  >
                    {t('simulateur.print')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<RotateCcw className="size-4" />}
                    onClick={clearCart}
                    className="text-error hover:bg-red-50"
                  >
                    {t('simulateur.clear')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// --- Composant Principal ---
export default function Vitrine() {
  const { t } = useTranslation(['vitrine', 'common']);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'gestion' | 'simulateur'>('gestion');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showPublicOnly, setShowPublicOnly] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: publicCount = 0 } = useQuery({
    queryKey: ['vitrine-stats-count'],
    queryFn: async () => {
      const response = await api.get('produits/', { params: { is_public: 'true', page_size: 1 } });
      return response.data.count || 0;
    },
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['vitrine-products', debouncedSearch, showPublicOnly],
    queryFn: async () => {
      const params: Record<string, string> = { search: debouncedSearch };
      if (showPublicOnly) params.is_public = 'true';
      const response = await api.get('produits/', { params });
      return response.data.results || response.data;
    },
    enabled: activeTab === 'gestion',
  });

  const toggleVisibility = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`produits/${id}/toggle_public/`);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['vitrine-products'] });
      const previousProducts = queryClient.getQueryData(['vitrine-products']);
      queryClient.setQueryData(
        ['vitrine-products', debouncedSearch, showPublicOnly],
        (old: Product[] | { results: Product[] } | undefined) => {
          if (!old) return old;
          const list = Array.isArray(old) ? old : old.results;
          const updatedList = list.map((p: Product) =>
            p.id === id ? { ...p, is_public: !p.is_public } : p
          );
          return Array.isArray(old) ? updatedList : { ...old, results: updatedList };
        }
      );
      return { previousProducts };
    },
    onError: (_err, _newTodo, context) => {
      queryClient.setQueryData(
        ['vitrine-products', debouncedSearch, showPublicOnly],
        context?.previousProducts
      );
      gooeyToast.error(t('messages.update_error'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['vitrine-products'] });
      queryClient.invalidateQueries({ queryKey: ['vitrine-stats-count'] });
    },
    onSuccess: () => {
      gooeyToast.success(t('messages.visibility_updated'));
    },
  });

  const updatePrice = useMutation({
    mutationFn: async ({ id, price }: { id: number; price: number | null }) => {
      await api.patch(`produits/${id}/`, { public_price: price });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vitrine-products'] });
      gooeyToast.success(t('messages.price_updated'));
    },
    onError: () => gooeyToast.error(t('messages.generic_error')),
  });

  const bulkToggle = useMutation({
    mutationFn: async ({ ids, target_status }: { ids: number[]; target_status: boolean }) => {
      await api.post('produits/bulk_toggle_public/', { ids, target_status });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vitrine-products'] });
      queryClient.invalidateQueries({ queryKey: ['vitrine-stats-count'] });
      gooeyToast.success(
        variables.target_status ? t('messages.bulk_published') : t('messages.bulk_unpublished')
      );
    },
    onError: () => gooeyToast.error(t('messages.bulk_error')),
  });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Globe className="size-6 lg:size-8 text-emerald-500" />
            {t('title')}
          </h1>
          <p className="text-sm lg:text-base text-base-content/60 mt-1">{t('subtitle')}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch lg:items-center gap-4 lg:gap-6">
          <Card variant="elevated" padding="sm" className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600">
              <Package className="size-5" />
            </div>
            <div>
              <div className="text-xs text-base-content/60 font-medium uppercase tracking-wider">
                {t('online_count')}
              </div>
              <div className="text-xl font-bold leading-none">{formatNumber(publicCount)}</div>
            </div>
          </Card>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'gestion' | 'simulateur')}
          >
            <TabsList className="grid w-full sm:w-auto grid-cols-2">
              <TabsTrigger value="gestion">{t('tabs.gestion')}</TabsTrigger>
              <TabsTrigger value="simulateur">{t('tabs.simulateur')}</TabsTrigger>
            </TabsList>
          </Tabs>
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
