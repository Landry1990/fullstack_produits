import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { ProduitModel } from '../../types';
import { useRayons } from '../../hooks/useProduits';
import PremiumModal from '../common/PremiumModal';
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
  ShieldCheck,
  Download
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Checkbox } from '../ui/Checkbox';

export default function ReapproRayon() {
  const { t, i18n } = useTranslation(['stock', 'common']);
  const { user } = useAuth();
  const [products, setProducts] = useState<ProduitModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferringIds, setTransferringIds] = useState<number[]>([]);
  const [showConfirmBulk, setShowConfirmBulk] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
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
        setSelectedIds([]);
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
    if (selectedIds.length === products.length) {
        setSelectedIds([]);
    } else {
        setSelectedIds(products.map(p => p.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
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
    const ids = type === 'all' ? products.map(p => p.id) : selectedIds;
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
    <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
      
      {/* Header & Stats Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 no-print">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary text-primary-content rounded-2xl shadow-lg shadow-primary/20">
              <Package className="w-6 h-6" />
            </div>
            <div>
                <h1 className="text-2xl font-black text-base-content tracking-tight">{t('reappro.title', { defaultValue: 'Réapprovisionnement Rayon' })}</h1>
                <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mt-0.5">{t('reappro.subtitle', { defaultValue: 'Gérer les transferts Réserve &rarr; Rayon' })}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link 
            to="/app/reappro-history" 
            className="btn btn-sm btn-ghost hover:bg-base-100 text-[10px] font-black uppercase tracking-widest gap-2 rounded-xl border border-base-300 shadow-sm"
          >
            <History className="w-3.5 h-3.5" />
            Historique
          </Link>
          <div className="flex items-center gap-2 bg-base-100 p-1.5 rounded-xl shadow-sm border border-base-300">
            <button 
                onClick={fetchNeedsRefill} 
                className={`btn btn-sm btn-ghost hover:bg-base-200 text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg ${loading ? 'loading' : ''}`}
            >
                {!loading && <RefreshCw className="w-3.5 h-3.5" />}
                {t('common:refresh')}
            </button>
            <button 
                onClick={() => window.print()} 
                className="btn btn-sm btn-ghost hover:bg-base-200 text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg"
            >
                <Printer className="w-3.5 h-3.5" />
                {t('common:print')}
            </button>
          </div>

          <div className="flex items-center gap-2 bg-base-100 p-1.5 rounded-xl shadow-sm border border-base-300">
            <button 
                onClick={() => handleBulkAction('all')}
                className="btn btn-sm btn-primary text-[10px] font-black uppercase tracking-widest gap-2 rounded-lg"
                disabled={loading || products.length === 0}
            >
                <Truck className="w-3.5 h-3.5" />
                Tout réapprovisionner
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
        <div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden p-6 flex flex-row items-center gap-4">
          <div className={`p-3 rounded-xl ${stats.criticalProductsCount > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Alertes Critiques</p>
            <p className="text-2xl font-black">{stats.criticalProductsCount}</p>
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden p-6 flex flex-row items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Volume Suggéré</p>
            <p className="text-2xl font-black">{stats.totalToTransfer} <small className="text-xs">unités</small></p>
          </div>
        </div>
        <div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden p-6 flex flex-row items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-100 text-purple-600">
            <Filter className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Produits Affichés</p>
            <p className="text-2xl font-black">{stats.totalDisplayed}</p>
          </div>
        </div>
      </div>

      {/* Main Content Section */}
      <div className="bg-base-100 rounded-3xl shadow-sm border border-base-300 overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-6 border-b border-base-200 flex flex-col md:flex-row md:items-center justify-between gap-6 bg-base-50/50 no-print">
          <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
              <input 
                type="text" 
                placeholder={t('common:search_product_placeholder')} 
                className="input input-sm h-11 w-full pl-11 bg-base-100 border-base-300 focus:border-primary rounded-xl text-sm font-bold"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
            <select 
              className="select select-sm h-11 bg-base-100 border-base-300 focus:border-primary rounded-xl text-sm font-bold min-w-[200px]"
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
            <div className="form-control">
              <label className="label cursor-pointer gap-3 bg-base-100 px-4 py-2 rounded-xl border border-base-300 shadow-sm transition-all hover:bg-base-200">
                <span className="label-text text-[10px] font-black uppercase tracking-widest text-base-content/60">Seulement les alertes</span> 
                <input 
                    type="checkbox" 
                    className="toggle toggle-primary toggle-sm" 
                    checked={onlyAlerts}
                    onChange={(e) => setOnlyAlerts(e.target.checked)}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Selection Action Bar (Sticky) */}
        {selectedIds.length > 0 && (
            <div className="px-6 py-3 bg-primary/5 border-b border-primary/10 flex items-center justify-between animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-3">
                    <div className="bg-primary text-primary-content w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black">
                        {selectedIds.length}
                    </div>
                    <span className="text-xs font-black text-primary uppercase tracking-widest">Produits sélectionnés</span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        className="btn btn-xs btn-ghost text-[10px] font-black uppercase tracking-widest"
                        onClick={() => setSelectedIds([])}
                    >
                        Annuler
                    </button>
                    <button 
                        className="btn btn-xs btn-primary px-4 text-[10px] font-black uppercase tracking-widest rounded-lg shadow-md shadow-primary/20"
                        onClick={() => handleBulkAction('selection')}
                    >
                        Réapprovisionner la sélection
                    </button>
                </div>
            </div>
        )}

        {/* Table Content */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="table w-full">
            <thead>
              <tr className="bg-base-200/30 border-b border-base-200">
                <th className="bg-transparent w-12 no-print">
                    <Checkbox
                        checked={selectedIds.length === products.length && products.length > 0}
                        indeterminate={selectedIds.length > 0 && selectedIds.length < products.length}
                        onChange={toggleSelectAll}
                        size="sm"
                    />
                </th>
                <th className="bg-transparent text-[10px] font-black uppercase tracking-widest text-base-content/40">Produit</th>
                <th className="bg-transparent text-[10px] font-black uppercase tracking-widest text-base-content/40">État du Rayon</th>
                <th className="bg-transparent text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">Rayon</th>
                <th className="bg-transparent text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center">Réserve</th>
                <th className="bg-transparent text-[10px] font-black uppercase tracking-widest text-base-content/40 text-center text-primary">Suggestion</th>
                <th className="bg-transparent text-[10px] font-black uppercase tracking-widest text-base-content/40 text-right no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && products.length === 0 ? (
                <tr>
                   <td colSpan={7} className="py-24 text-center">
                      <span className="loading loading-spinner loading-lg text-primary"></span>
                      <p className="text-[10px] font-black uppercase tracking-widest text-base-content/30 mt-4 italic">Analyse des stocks en cours...</p>
                   </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                   <td colSpan={7} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center opacity-20">
                          <Package className="w-16 h-16 mb-4" />
                          <h3 className="text-xl font-black uppercase tracking-tight">Aucun produit à réapprovisionner</h3>
                          <p className="text-sm font-bold max-w-xs mt-2 italic">Tous vos rayons sont actuellement bien fournis selon les paramètres de stock.</p>
                      </div>
                   </td>
                </tr>
              ) : (
                paginatedProducts.map(p => {
                  const needed = Math.max(0, (p.capacite_rayon ?? 0) - (p.stock ?? 0));
                  const suggest = Math.min(needed, p.stock_reserve ?? 0);
                  const isLow = (p.stock ?? 0) <= (p.min_rayon ?? 0);
                  const percent = Math.min(100, Math.max(0, ((p.stock ?? 0) / (p.capacite_rayon || 1)) * 100));
                  const isSelected = selectedIds.includes(p.id);

                  return (
                    <tr key={p.id} className={`group hover:bg-base-200/30 transition-all border-b border-base-200/50 ${isSelected ? 'bg-primary/5' : ''}`}>
                      <td className="no-print">
                        <Checkbox
                            checked={isSelected}
                            onChange={() => toggleSelect(p.id)}
                            size="sm"
                        />
                      </td>
                      <td>
                        <div className="flex flex-col">
                            <span className="text-xs font-black text-base-content max-w-[200px] truncate">{p.name}</span>
                            <span className="text-[9px] font-bold text-base-content/30 uppercase tracking-widest">{p.rayon_name || 'Sans Rayon'}</span>
                        </div>
                      </td>
                      <td className="w-48">
                        <div className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center px-1">
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isLow ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${isLow ? 'text-red-700' : 'text-emerald-700'}`}>
                                        {isLow ? 'Alerte Critique' : 'Niveau Correct'}
                                    </span>
                                </div>
                                <span className="text-[9px] font-black text-base-content/30">{Math.round(percent)}%</span>
                            </div>
                            <div className="h-2 w-full bg-base-200 rounded-full overflow-hidden flex">
                                <div 
                                    className={`h-full transition-all duration-700 ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${percent}%` }}
                                />
                            </div>
                        </div>
                      </td>
                      <td className="text-center">
                        <span className="text-xs font-black text-base-content">{p.stock}</span>
                        <div className="flex items-center justify-center gap-1 mt-0.5 opacity-30">
                            <span className="text-[8px] font-bold">MIN {p.min_rayon ?? 0}</span>
                            <span className="text-[8px] font-bold">CAP {p.capacite_rayon ?? 0}</span>
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="inline-flex flex-col items-center bg-base-200 px-3 py-1 rounded-lg border border-base-300">
                            <span className="text-xs font-black text-base-content">{p.stock_reserve || 0}</span>
                            <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">Réserve</span>
                        </div>
                      </td>
                      <td className="text-center">
                        {suggest > 0 ? (
                            <div className="flex flex-col items-center animate-in zoom-in duration-300">
                                <span className="text-sm font-black text-primary">+{suggest}</span>
                                <div className="flex items-center gap-1 text-[8px] font-black text-primary/40 uppercase tracking-widest">
                                    <ChevronRight className="w-2 h-2" /> Suggéré
                                </div>
                            </div>
                        ) : (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto opacity-20" />
                        )}
                      </td>
                      <td className="text-right no-print">
                        <button 
                            className={`btn btn-sm btn-ghost hover:bg-primary hover:text-white group/btn rounded-xl transition-all border border-transparent hover:border-primary ${isLow ? 'text-primary' : 'text-base-content/40'}`}
                            onClick={() => handleTransfer(p)}
                            disabled={suggest <= 0}
                        >
                            <Truck className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                            <span className="text-[9px] font-black uppercase tracking-widest ml-2 hidden xl:inline">Transférer</span>
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
            <div className="p-6 border-t border-base-200 flex items-center justify-between bg-base-50/10 no-print">
                <span className="text-[10px] font-black uppercase tracking-widest text-base-content/30">
                    Page {page} sur {totalPages} ({products.length} produits)
                </span>
                <div className="flex items-center gap-1 bg-base-200 p-1 rounded-xl border border-base-300">
                    <button 
                        className="btn btn-xs btn-ghost hover:bg-base-100 rounded-lg text-[10px] font-black uppercase tracking-widest"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                    >
                        Précédent
                    </button>
                    <div className="px-3 text-[10px] font-black">{page}</div>
                    <button 
                        className="btn btn-xs btn-ghost hover:bg-base-100 rounded-lg text-[10px] font-black uppercase tracking-widest"
                        disabled={page === totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        Suivant
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Bulk Confirmation Modal */}
      <PremiumModal
        isOpen={showConfirmBulk}
        onClose={() => {
            setShowConfirmBulk(false);
            if (bulkActionType === null) setPendingIds([]);
        }}
        title="Confirmation de transfert"
        maxWidth="max-w-md"
      >
        <div className="p-8 text-center">
            <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Truck className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-base-content tracking-tight">Réapprovisionner les stocks ?</h3>
            <p className="text-sm font-bold text-base-content/40 mt-3 leading-relaxed">
                Vous êtes sur le point de transférer les stocks réserve vers le rayon pour 
                <span className="text-primary mx-1">{pendingIds.length}</span> 
                produits.
            </p>
            
            <div className="flex gap-4 mt-8">
                <button 
                    className="btn btn-ghost flex-1 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest"
                    onClick={() => setShowConfirmBulk(false)}
                >
                    Annuler
                </button>
                <button 
                    className="btn btn-primary flex-1 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                    onClick={() => {
                        setShowConfirmBulk(false);
                        executeBulkTransfer(pendingIds);
                    }}
                >
                    Confirmer
                </button>
            </div>
        </div>
      </PremiumModal>

      {/* Success Modal with PDF Link */}
      <PremiumModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Réapprovisionnement Terminé"
        maxWidth="max-w-md"
      >
        <div className="p-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-black text-base-content tracking-tight">Transfert Réussi !</h3>
            <p className="text-sm font-bold text-base-content/40 mt-3 leading-relaxed">
                Les stocks ont été transférés. Vous pouvez télécharger le document de confirmation ou consulter l'historique détaillé.
            </p>
            
            <div className="flex flex-col gap-3 mt-8">
                <button 
                    className="btn btn-primary h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 border-none gap-2"
                    onClick={() => {
                        if (lastSessionId) handleDownloadPdf(lastSessionId);
                        setShowSuccessModal(false);
                    }}
                >
                    <Download className="w-4 h-4" />
                    Télécharger la confirmation PDF
                </button>
                <div className="grid grid-cols-2 gap-3">
                    <Link 
                        to="/app/reappro-history"
                        className="btn btn-ghost h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-base-300"
                    >
                        Voir Historique
                    </Link>
                    <button 
                        className="btn btn-ghost h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-base-300"
                        onClick={() => setShowSuccessModal(false)}
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
      </PremiumModal>

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
        title="Validation Requise"
        message="Veuillez confirmer votre identité pour effectuer ce transfert de stock groupé."
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

