import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { ProduitModel } from '../../types';
import { useRayons } from '../../hooks/useProduits';
import SudoValidationModal from '../common/SudoValidationModal';
import { useAuth } from '../../context/AuthContext';
import produitService from '../../services/produitService';
import { 
  Package, 
  History, 
  RefreshCw, 
  Printer, 
  Truck, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Download,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Checkbox } from '../ui/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/Dialog';
import { Button } from '../ui/Button';

export default function ReapproRayon() {
  const { t, i18n } = useTranslation(['stock', 'common']);
  const { user } = useAuth();
  const [products, setProducts] = useState<ProduitModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferringIds, setTransferringIds] = useState<number[]>([]);
  const [showConfirmBulk, setShowConfirmBulk] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSessionId, setLastSessionId] = useState<number | null>(null);
  
  // Sudo Mode States
  const [sudoModalOpen, setSudoModalOpen] = useState(false);
  const [sudoSaving, setSudoSaving] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'selection' | 'all' | null>(null);
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRayon, setSelectedRayon] = useState<string>('');
  const [onlyAlerts, setOnlyAlerts] = useState(true);
  
  // Pagination
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

  const { data: rayons = [] } = useRayons();

  const fetchNeedsRefill = async () => {
    setLoading(true);
    try {
        const response = await produitService.getAll({
            has_reserve_storage: true,
            needs_reappro: onlyAlerts ? true : undefined,
            page_size: 1000,
            search: searchQuery || undefined,
            rayon: selectedRayon || undefined
        });
        setProducts(response.results || []);
        setSelectedIds(new Set());
    } catch (error) {
      console.error('Error fetching refill needs:', error);
      toast.error(t('reappro.messages.error_loading_products'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNeedsRefill();
  }, [onlyAlerts, selectedRayon]); // We'll handle search with a small delay or button if needed, but for now simple

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
        if (searchQuery.length === 0 || searchQuery.length > 2) {
            fetchNeedsRefill();
        }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const criticalProductsCount = products.filter(p => (p.stock ?? 0) <= (p.min_rayon ?? 0)).length;
    const totalToTransfer = products.reduce((acc, p) => {
        const needed = Math.max(0, (p.capacite_rayon ?? 0) - (p.stock ?? 0));
        return acc + Math.min(needed, p.stock_reserve ?? 0);
    }, 0);
    return { criticalProductsCount, totalToTransfer, totalDisplayed: products.length };
  }, [products]);

  // Pagination locale
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const paginatedProducts = products.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
        setSelectedIds(new Set());
    } else {
        setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const toggleSelect = (id: number) => {
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

  const handleTransfer = async (produit: ProduitModel) => {
    const needed = Math.max(0, (produit.capacite_rayon ?? 0) - (produit.stock ?? 0));
    const suggest = Math.min(needed, produit.stock_reserve ?? 0);
    
    if (suggest <= 0) {
      toast.error(t('reappro.messages.no_refill_needed'));
      return;
    }

    const hasPermission = user?.is_superuser || user?.can_adjust_stock || user?.profile?.can_adjust_stock;
    
    if (!hasPermission) {
      setBulkActionType(null); // Not really bulk but we'll use sudo modal
      // We'll reuse bulkTransferToShelf with a single ID for consistency
      setPendingIds([produit.id]);
      setSudoModalOpen(true);
      return;
    }

    executeBulkTransfer([produit.id]);
  };

  const [pendingIds, setPendingIds] = useState<number[]>([]);

  const handleBulkAction = (type: 'selection' | 'all') => {
    const ids = type === 'all' ? products.map(p => p.id) : Array.from(selectedIds);
    if (ids.length === 0) return;

    setPendingIds(ids);
    setBulkActionType(type);

    const hasPermission = user?.is_superuser || user?.can_adjust_stock || user?.profile?.can_adjust_stock;
    if (!hasPermission) {
      setSudoModalOpen(true);
      return;
    }

    setShowConfirmBulk(true);
  };

  const executeBulkTransfer = async (ids: number[], sudoCreds?: { validated_by_id: number, sudo_password: string }) => {
    setLoading(true);
    try {
        const res = await produitService.bulkTransferToShelf(ids, sudoCreds);
        toast.success(res.detail || t('reappro.messages.bulk_success', { success: ids.length, total: ids.length }));
        
        if (res.session_id) {
            setLastSessionId(res.session_id);
            setShowSuccessModal(true);
        }

        fetchNeedsRefill();
    } catch (error: any) {
        toast.error(error.response?.data?.detail || t('common:error_generic'));
    } finally {
        setLoading(false);
        setPendingIds([]);
    }
  };

  const handleDownloadPdf = async (sessionId: number) => {
    try {
      const blob = await produitService.getReapproSessionPdf(sessionId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `reappro_session_${sessionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error("Erreur lors du téléchargement du PDF");
    }
  };

  const handleSudoValidate = async (validatorId: number, password: string) => {
    setSudoSaving(true);
    try {
      await executeBulkTransfer(pendingIds, { validated_by_id: validatorId, sudo_password: password });
      setSudoModalOpen(false);
      setBulkActionType(null);
    } catch (err) {
      // Error handled in executeBulkTransfer
    } finally {
      setSudoSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6 font-sans">
      
      {/* Header & Stats Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 no-print">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20">
              <Package className="size-6" />
            </div>
            <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">{t('reappro.title', { defaultValue: 'Réapprovisionnement Rayon' })}</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{t('reappro.subtitle', { defaultValue: 'Gérer les transferts Réserve → Rayon' })}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/app/reappro-history"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 shadow-sm transition-all"
          >
            <History className="size-3.5" />
            {t('common:history')}
          </Link>
          <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl shadow-sm border border-slate-200">
            <button
                onClick={fetchNeedsRefill}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-colors"
            >
                {loading ? <span className="animate-spin rounded-full size-3.5 border-b-2 border-slate-400"></span> : <RefreshCw className="size-3.5" />}
                {t('common:refresh')}
            </button>
            <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-colors"
            >
                <Printer className="size-3.5" />
                {t('common:print')}
            </button>
          </div>

          <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-slate-200">
            <button
                onClick={() => handleBulkAction('all')}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                disabled={loading || products.length === 0}
            >
                <Truck className="size-3.5" />
                {t('stock:reappro.transfer_all')}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
        <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-6 flex flex-row items-center gap-4">
          <div className={`p-3 rounded-xl ${stats.criticalProductsCount > 0 ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
            <AlertCircle className="size-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('stock:reappro.critical_alerts')}</p>
            <p className="text-2xl font-black text-slate-800">{stats.criticalProductsCount}</p>
          </div>
        </div>
        <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-6 flex flex-row items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-500">
            <Truck className="size-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('stock:reappro.suggested_volume')}</p>
            <p className="text-2xl font-black text-slate-800">{stats.totalToTransfer} <small className="text-xs text-slate-400">unités</small></p>
          </div>
        </div>
        <div className="bg-white shadow-sm border border-slate-200 rounded-2xl p-6 flex flex-row items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
            <Filter className="size-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('stock:reappro.displayed_products')}</p>
            <p className="text-2xl font-black text-slate-800">{stats.totalDisplayed}</p>
          </div>
        </div>
      </div>

      {/* Main Content Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/50 no-print">
          <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-300" />
              <input
                type="text"
                placeholder={t('common:search_product_placeholder')}
                className="h-11 w-full pl-11 pr-4 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-sm font-bold text-slate-700 focus:outline-none transition-all"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
            <select
              className="h-11 px-3 bg-white border border-slate-200 focus:border-emerald-500 focus:outline-none rounded-xl text-sm font-bold text-slate-700 min-w-[200px]"
              value={selectedRayon}
              onChange={(e) => { setSelectedRayon(e.target.value); setPage(1); }}
            >
              <option value="">{t('common:all_rayons')}</option>
              {rayons.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4">
            <label className="cursor-pointer flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-all">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t('stock:reappro.alerts_only')}</span>
              <div className="relative inline-flex">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={onlyAlerts}
                  onChange={(e) => setOnlyAlerts(e.target.checked)}
                />
                <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors"></div>
                <div className="absolute top-0.5 left-0.5 size-4 bg-white rounded-full shadow transition-all peer-checked:translate-x-4"></div>
              </div>
            </label>
          </div>
        </div>

        {/* Selection Action Bar (Sticky) */}
        {selectedIds.size > 0 && (
            <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-600 text-white size-6 rounded-lg flex items-center justify-center text-[10px] font-black">
                        {selectedIds.size}
                    </div>
                    <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">{t('stock:reappro.selected_products')}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="inline-flex items-center h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors"
                        onClick={() => setSelectedIds(new Set())}
                    >
                        Annuler
                    </button>
                    <button
                        className="inline-flex items-center h-7 px-4 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 shadow-md transition-colors"
                        onClick={() => handleBulkAction('selection')}
                    >
                        {t('stock:reappro.transfer')}
                    </button>
                </div>
            </div>
        )}

        {/* Table Content */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="w-12 px-4 py-3 no-print">
                    <Checkbox
                        checked={selectedIds.size === products.length && products.length > 0}
                        indeterminate={selectedIds.size > 0 && selectedIds.size < products.length}
                        onChange={toggleSelectAll}
                        size="sm"
                    />
                </th>
                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-left">{t('stock:reappro.columns.product')}</th>
                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-left">{t('stock:reappro.columns.section_status')}</th>
                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-center">{t('stock:reappro.columns.section')}</th>
                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-center">{t('stock:reappro.columns.reserve')}</th>
                <th className="text-[10px] font-black uppercase tracking-widest text-emerald-600 py-3 text-center">{t('stock:reappro.columns.suggestion')}</th>
                <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-3 text-right no-print">{t('stock:reappro.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && products.length === 0 ? (
                <tr>
                   <td colSpan={7} className="py-24 text-center">
                      <div className="animate-spin rounded-full size-10 border-b-2 border-emerald-500 mx-auto"></div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mt-4 italic">{t('stock:reappro.loading')}</p>
                   </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                   <td colSpan={7} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-200">
                          <Package className="size-16 mb-4" />
                          <h3 className="text-xl font-black uppercase tracking-tight">{t('stock:reappro.empty')}</h3>
                          <p className="text-sm font-bold max-w-xs mt-2 italic">{t('stock:reappro.empty_desc')}</p>
                      </div>
                   </td>
                </tr>
              ) : (
                paginatedProducts.map(p => {
                  const needed = Math.max(0, (p.capacite_rayon ?? 0) - (p.stock ?? 0));
                  const suggest = Math.min(needed, p.stock_reserve ?? 0);
                  const isLow = (p.stock ?? 0) <= (p.min_rayon ?? 0);
                  const percent = Math.min(100, Math.max(0, ((p.stock ?? 0) / (p.capacite_rayon || 1)) * 100));
                  const isSelected = selectedIds.has(p.id);

                  return (
                    <tr key={p.id} className={`group hover:bg-slate-50/60 transition-all border-b border-slate-100 ${isSelected ? 'bg-emerald-50/30' : ''}`}>
                      <td className="no-print px-4 py-3">
                        <Checkbox
                            checked={isSelected}
                            onChange={() => toggleSelect(p.id)}
                            size="sm"
                        />
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-800 max-w-[200px] truncate">{p.name}</span>
                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{p.rayon_name || t('common:no_section')}</span>
                        </div>
                      </td>
                      <td className="w-48">
                        <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center px-1">
                                <div className="flex items-center gap-1.5">
                                    <div className={`size-1.5 rounded-full ${isLow ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${isLow ? 'text-red-500' : 'text-emerald-600'}`}>
                                        {isLow ? t('stock:reappro.status.critical') : t('stock:reappro.status.ok')}
                                    </span>
                                </div>
                                <span className="text-[9px] font-black text-slate-300">{Math.round(percent)}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                <div 
                                    className={`h-full transition-all duration-700 ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                        </div>
                      </td>
                      <td className="text-center py-3">
                        <span className="text-xs font-black text-slate-800">{p.stock}</span>
                        <div className="flex items-center justify-center gap-1 mt-0.5 text-slate-300">
                            <span className="text-[8px] font-bold">{t('stock:reappro.min')} {p.min_rayon ?? 0}</span>
                            <span className="text-[8px] font-bold">{t('stock:reappro.cap')} {p.capacite_rayon ?? 0}</span>
                        </div>
                      </td>
                      <td className="text-center py-3">
                        <div className="inline-flex flex-col items-center bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                            <span className="text-xs font-black text-slate-700">{p.stock_reserve || 0}</span>
                            <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">Réserve</span>
                        </div>
                      </td>
                      <td className="text-center py-3">
                        {suggest > 0 ? (
                            <div className="flex flex-col items-center animate-in zoom-in duration-300">
                                <span className="text-sm font-black text-emerald-600">+{suggest}</span>
                                <div className="flex items-center gap-1 text-[8px] font-black text-emerald-400 uppercase tracking-widest">
                                    <ChevronRight className="size-2" /> {t('stock:reappro.suggested')}
                                </div>
                            </div>
                        ) : (
                            <CheckCircle2 className="size-5 text-emerald-500 mx-auto text-base-content/20" />
                        )}
                      </td>
                      <td className="text-right py-3 no-print">
                        <button
                            className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl text-[9px] font-black uppercase tracking-widest border border-transparent hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 group/btn transition-all ${
                              isLow ? 'text-emerald-600' : 'text-slate-300'
                            } disabled:opacity-30`}
                            onClick={() => handleTransfer(p)}
                            disabled={suggest <= 0}
                        >
                            <Truck className="size-4 transition-transform group-hover/btn:translate-x-1" />
                            <span className="hidden xl:inline">{t('stock:reappro.transfer')}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {products.length > itemsPerPage && (
            <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/10 no-print">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    Page {page} sur {totalPages} ({products.length} produits)
                </span>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                        className="inline-flex items-center justify-center h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-white disabled:opacity-30 transition-colors"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                    >
                        {t('common:previous')}
                    </button>
                    <div className="px-3 text-[10px] font-black text-slate-700">{page}</div>
                    <button
                        className="inline-flex items-center justify-center h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-white disabled:opacity-30 transition-colors"
                        disabled={page === totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        {t('common:next')}
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* ── Modal Confirmation Transfert Groupé ── */}
      <Dialog open={showConfirmBulk} onOpenChange={(open) => {
        if (!open) { setShowConfirmBulk(false); if (bulkActionType === null) setPendingIds([]); }
      }}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
          {/* Bande accent emerald */}
          <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600" />
          <div className="px-8 pt-8 pb-6">
            <div className="flex flex-col items-center text-center gap-5">
              <div className="size-20 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shadow-inner">
                <Truck className="size-9 text-emerald-600" />
              </div>
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-xl font-black text-slate-800 tracking-tight">
                  {t('stock:reappro.modal.title')}
                </DialogTitle>
                <DialogDescription className="text-sm font-semibold text-slate-400 leading-relaxed">
                  {t('stock:reappro.modal.confirm', { count: pendingIds.length })}
                </DialogDescription>
              </DialogHeader>
              <div className="w-full flex items-center justify-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                <div className="size-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Package className="size-4 text-emerald-600" />
                </div>
                <span className="text-sm font-black text-emerald-700">
                  {pendingIds.length} produit{pendingIds.length > 1 ? 's' : ''} à transférer
                </span>
                <ArrowRight className="size-4 text-emerald-400 ml-auto" />
              </div>
            </div>
            <DialogFooter className="flex gap-3 mt-6 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1 h-11 rounded-xl font-black text-[10px] uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50"
                onClick={() => setShowConfirmBulk(false)}
              >
                {t('stock:reappro.modal.cancel')}
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl font-black text-[10px] uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25"
                onClick={() => { setShowConfirmBulk(false); executeBulkTransfer(pendingIds); }}
              >
                <Truck className="size-3.5 mr-2" />
                {t('stock:reappro.modal.confirm_btn')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Succès + Téléchargement PDF ── */}
      <Dialog open={showSuccessModal} onOpenChange={(open) => { if (!open) setShowSuccessModal(false); }}>
        <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600" />
          <div className="px-8 pt-8 pb-6">
            <div className="flex flex-col items-center text-center gap-5">
              <div className="relative">
                <div className="size-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="size-10 text-emerald-600" />
                </div>
                <div className="absolute -top-1 -right-1 size-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                  <span className="text-white text-[9px] font-black">✓</span>
                </div>
              </div>
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-xl font-black text-slate-800 tracking-tight">
                  {t('stock:reappro.modal.success')}
                </DialogTitle>
                <DialogDescription className="text-sm font-semibold text-slate-400 leading-relaxed">
                  {t('stock:reappro.modal.success_desc')}
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex flex-col gap-3 mt-6">
              <Button
                className="w-full h-11 rounded-xl font-black text-[10px] uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25"
                onClick={() => { if (lastSessionId) handleDownloadPdf(lastSessionId); setShowSuccessModal(false); }}
              >
                <Download className="size-3.5 mr-2" />
                {t('stock:reappro.modal.download_pdf')}
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/app/reappro-history"
                  className="inline-flex items-center justify-center h-11 rounded-xl font-black text-[10px] uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors gap-1.5"
                >
                  <History className="size-3.5" />
                  {t('stock:reappro.modal.view_history')}
                </Link>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl font-black text-[10px] uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50"
                  onClick={() => setShowSuccessModal(false)}
                >
                  {t('stock:reappro.modal.close')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sudo Mode Validation */}
      <SudoValidationModal
        isOpen={sudoModalOpen}
        onClose={() => {
          setSudoModalOpen(false);
          setPendingIds([]);
          setBulkActionType(null);
        }}
        onValidate={handleSudoValidate}
        saving={sudoSaving}
        title={t('sudo.title', 'Validation Requise')}
        message={t('sudo.message', 'Veuillez confirmer votre identité pour effectuer ce transfert de stock groupé.')}
      />
      
      {/* Print Styles */}
      <style>
          {`
            @media print {
              .no-print { display: none !important; }
              body { background: white !important; font-size: 11pt; color: black !important; }
              .card, .bg-base-100 { border: none !important; box-shadow: none !important; }
              table { width: 100%; border-collapse: collapse; }
              th { text-transform: uppercase; font-size: 9pt; border-bottom: 2px solid black !important; padding: 10px 5px !important; }
              td { border-bottom: 1px solid #eee !important; padding: 10px 5px !important; }
              .bg-primary/5 { background: transparent !important; }
              .badge { border: 1px solid #ddd !important; background: transparent !important; }
              @page { margin: 1.5cm; }
            }
          `}
      </style>
    </div>
  );
}

