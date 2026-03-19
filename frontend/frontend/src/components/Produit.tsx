
import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from '../config/axios'
import { toast } from 'react-hot-toast'
import { useConfirm } from '../hooks/useConfirm';
import { useAuth } from '../context/AuthContext';
import PasswordConfirmModal from './PasswordConfirmModal';
import type { ProduitModel, Facture } from '../types'

import {
  useProduits,
  useRayons,
  useFournisseurs,
  useFormes,
  useGroupes,
  useProduitAchats,
  useProduitLots,
  useProduitStats,
  useProduitHistory,
  useUpdateProduit,
  useAdjustStock,
  useDeleteProduit,
  useRecalculateRotation
} from '../hooks/useProduits';
import { useTVA } from '../hooks/useTVA';

import ProduitCreateModal from './ProduitFormModal'
import { ProductDetailsModal as SalesDetailsModal } from './sales/modals/ProductDetailsModal';

// Modular Components
import { ProductFilters } from './products/ProductFilters';
import { ProductTable } from './products/ProductTable';
import { BulkActionsBar } from './products/BulkActionsBar';
import { ProductDetailPanel } from './products/ProductDetailPanel';
import { ProductDetailsModal } from './products/modals/ProductDetailsModal';
import { ProductEditModal } from './products/modals/ProductEditModal';
import { StockAdjustmentModal } from './products/modals/StockAdjustmentModal';

export default function Produit() {
  console.log('[Produit] Rendering component...');
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { t } = useTranslation(['products', 'common']);
  const { user } = useAuth();
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [filterRayon, setFilterRayon] = useState('')
  const [filterFournisseur, setFilterFournisseur] = useState('')
  const [filterExclusive, setFilterExclusive] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  // Modals Visibility
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false)
  
  // Selection
  const [selectedProduit, setSelectedProduit] = useState<ProduitModel | null>(null)
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState<'general' | 'prix' | 'achats' | 'lots' | 'stats' | 'mvmts'>('general')

  // Sales/Facture Details
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  const [loadingFacture, setLoadingFacture] = useState(false);

  // -- API CALLS (React Query) --
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setPage(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const { 
    data: productsData, 
    isLoading: loading, 
    error: loadError,
    refetch: refetchProduits
  } = useProduits({
    search: debouncedSearchQuery,
    page: page,
    rayon: filterRayon,
    fournisseur: filterFournisseur,
    include_inactive: showInactive
  });

  console.log('[Produit] useProduits hook state:', { 
    productsCount: productsData?.results?.length, 
    loading, 
    loadError 
  });

  const { data: rayons = [] } = useRayons();
  const { data: fournisseurs = [] } = useFournisseurs();
  const { data: formes = [] } = useFormes();
  const { data: groupes = [] } = useGroupes();
  const { tvaList, loading: loadingTVA } = useTVA();

  console.log('[Produit] Metadata loaded:', { 
    rayons: rayons.length, 
    fournisseurs: fournisseurs.length, 
    loadingTVA 
  });

  const produits = useMemo(() => productsData?.results || [], [productsData]);
  const totalCount = productsData?.count || 0;
  const totalPages = Math.ceil(totalCount / 50) || 1;

  const { data: lots = [], isLoading: detailsLoadingLots } = useProduitLots(selectedProduit?.id || null);
  const { data: monthlyStats = [], isLoading: detailsLoadingStats } = useProduitStats(selectedProduit?.id || null);
  const { data: achats = [], isLoading: loadingAchats } = useProduitAchats(selectedProduit?.id || null);
  const { data: stockHistory = [], isLoading: loadingHistory } = useProduitHistory(selectedProduit?.id || null, activeTab);

  const detailsLoading = detailsLoadingLots || detailsLoadingStats || loadingAchats;

  // Mutations
  const updateProduitMutation = useUpdateProduit();
  const deleteProduitMutation = useDeleteProduit();
  const adjustStockMutation = useAdjustStock();
  const recalculateRotationMutation = useRecalculateRotation();
  const [transferLoading, setTransferLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Constants
  const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL ?? ''), [])
  const produitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/produits/` : '/api/produits/'

  // -- FORMS --
  const [editForm, setEditForm] = useState<any>({
    name: '', stock: '', cost_price: '', selling_price: '', cip1: '', cip2: '', cip3: '',
    expire_date: '', stock_alert: '', stock_minimum: '', stock_maximum: '', tva: '19.25',
    rayon: '', fournisseur: '', forme: '', use_lot_management: true, requires_prescription: false,
    surveillance_category: 'NONE', is_supplier_exclusive: false, has_reserve_storage: false,
    capacite_rayon: '0', min_rayon: '0'
  })
  
  const [adjustmentForm, setAdjustmentForm] = useState({
    new_quantity: '',
    reason_type: 'INVENTAIRE'
  })

  // Sudo actions
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordModalConfig, setPasswordModalConfig] = useState({ title: '', message: '' });
  const [pendingAction, setPendingAction] = useState<() => Promise<void>>(() => Promise.resolve());

  // -- HANDLERS --
  const handleViewDetails = (produit: ProduitModel) => {
    setSelectedProduit(produit)
  }

  const handleTransferToRayon = async (produit: ProduitModel) => {
    if (!produit.has_reserve_storage || (produit.stock_reserve ?? 0) <= 0) return;
    const needed = Math.max(0, (produit.capacite_rayon ?? 0) - (produit.stock ?? 0));
    const suggest = Math.min(needed, produit.stock_reserve ?? 0);
    const informMsg = t('products:messages.transfer_prompt', { 
      reserve: produit.stock_reserve, 
      capacity: produit.capacite_rayon, 
      needed: needed 
    });
    const qtyStr = prompt(informMsg, String(suggest));
    if (qtyStr === null) return;
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) { toast.error(t('products:messages.invalid_quantity')); return; }

    setTransferLoading(true);
    try {
      await axios.post(`${produitsEndpoint}${produit.id}/transfer_to_shelf/`, { quantity: qty });
      toast.success(t('products:messages.transfer_success', { count: qty }));
      refetchProduits();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('products:messages.transfer_error'));
    } finally { setTransferLoading(false); }
  };

  const handleMovementClick = async (item: any) => {
    if (item.facture && (item.type === 'SORTIE' || item.type === 'RETOUR')) {
      try {
        setLoadingFacture(true);
        setShowSalesModal(true);
        const response = await axios.get(`/api/factures/${item.facture}/`);
        setSelectedFacture(response.data);
      } catch (error) {
        toast.error(t('products:messages.facture_load_error'));
        setShowSalesModal(false);
      } finally { setLoadingFacture(false); }
    } else if (item.commande) {
      navigate('/app/commandes', { state: { openDetailsId: item.commande } });
    }
  };

  const executeDeleteProduit = async (produitId: number) => {
    try {
      await deleteProduitMutation.mutateAsync(produitId);
      setSelectedProduit(null)
      toast.success(t('products:messages.delete_success'))
    } catch (err) { toast.error(t('products:messages.delete_error')) }
  }

  const handleDeleteProduit = async (produit: ProduitModel) => {
    if (!user?.is_superuser && !user?.profile?.can_delete_product && !user?.can_delete_product) {
        toast.error(t('products:messages.access_denied_delete'))
        return
    }
    const confirmed = await confirm({
      title: t('products:messages.delete_confirm_title'),
      message: t('products:messages.delete_confirm_body', { name: produit.name }),
      variant: 'danger',
      confirmText: t('products:actions.delete')
    })
    if (!confirmed) return
    setPasswordModalConfig({
        title: t('products:messages.password_confirm_delete_title'),
        message: t('products:messages.password_confirm_delete_body')
    })
    setPendingAction(() => () => executeDeleteProduit(produit.id))
    setIsPasswordModalOpen(true)
  }

  const handleToggleActive = async (produit: ProduitModel) => {
    try {
      const response = await axios.post(`${produitsEndpoint}${produit.id}/toggle_active/`)
      const isActive = response.data.is_active
      toast.success(isActive ? t('products:messages.status_reactivated') : t('products:messages.status_hidden'))
      setSelectedProduit(prev => prev ? ({ ...prev, is_active: isActive }) : null)
      refetchProduits()
    } catch (err) { toast.error(t('products:messages.status_error')) }
  }

  const handleOpenEditModal = (produit: ProduitModel) => {
    setEditForm({
      name: produit.name,
      stock: String(produit.stock ?? ''),
      cost_price: String(produit.cost_price ?? ''),
      selling_price: String(produit.selling_price ?? ''),
      cip1: produit.cip1 || '',
      cip2: produit.cip2 || '',
      cip3: produit.cip3 || '',
      expire_date: produit.expire_date || '',
      stock_alert: String(produit.stock_alert ?? '0'),
      stock_minimum: String(produit.stock_minimum ?? '0'),
      stock_maximum: String(produit.stock_maximum ?? '0'),
      tva: produit.tva || '19.25',
      rayon: produit.rayon ? String(produit.rayon) : '',
      fournisseur: produit.fournisseur ? String(produit.fournisseur) : '',
      forme: produit.forme ? String(produit.forme) : '',
      use_lot_management: produit.use_lot_management ?? true,
      requires_prescription: produit.requires_prescription ?? false,
      surveillance_category: produit.surveillance_category || 'NONE',
      is_supplier_exclusive: produit.is_supplier_exclusive ?? false,
      has_reserve_storage: produit.has_reserve_storage ?? false,
      capacite_rayon: String(produit.capacite_rayon ?? '0'),
      min_rayon: String(produit.min_rayon ?? '0')
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateProduit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduit) return
    
    if (parseInt(editForm.stock || '0', 10) !== selectedProduit.stock) {
      toast.error('⚠️ ' + t('products:messages.stock_update_warning'), { duration: 6000 })
      setEditForm((prev: any) => ({ ...prev, stock: String(selectedProduit.stock) }))
      return
    }
    
    try {
      const payload = {
        ...editForm,
        name: editForm.name.trim().toUpperCase(),
        cip1: editForm.cip1?.trim() || null,
        cip2: editForm.cip2?.trim() || null,
        cip3: editForm.cip3?.trim() || null,
        expire_date: editForm.expire_date || null,
        stock_alert: parseInt(editForm.stock_alert || '0', 10),
        stock_minimum: parseInt(editForm.stock_minimum || '0', 10),
        stock_maximum: parseInt(editForm.stock_maximum || '0', 10),
        rayon: editForm.rayon ? parseInt(editForm.rayon, 10) : null,
        fournisseur: editForm.fournisseur ? parseInt(editForm.fournisseur, 10) : null,
        forme: editForm.forme ? parseInt(editForm.forme, 10) : null,
        capacite_rayon: parseInt(editForm.capacite_rayon || '0', 10),
        min_rayon: parseInt(editForm.min_rayon || '0', 10)
      }
      const updatedProduit = await updateProduitMutation.mutateAsync({ id: selectedProduit.id, data: payload })
      setSelectedProduit(updatedProduit)
      setIsEditModalOpen(false)
      toast.success(t('products:messages.update_success'))
    } catch (err) { toast.error(t('products:messages.update_error')) }
  }

  const executeStockAdjustment = async () => {
    if (!selectedProduit) return
    try {
      const data = await adjustStockMutation.mutateAsync({
        id: selectedProduit.id,
        quantity: parseInt(adjustmentForm.new_quantity),
        reason: adjustmentForm.reason_type
      });
      const qtyChangeStr = (data.quantity_change ?? 0) >= 0 ? '+' : '';
      toast.success(t('products:messages.adjust_success', { change: `${qtyChangeStr}${data.quantity_change ?? 0}` }))
      const qtyChange = data.quantity_change ?? 0;
      setSelectedProduit(prev => {
        if (!prev) return null;
        return {
          ...prev,
          stock: (prev.stock ?? 0) + qtyChange
        };
      });
      setIsAdjustmentModalOpen(false)
    } catch (err: any) { toast.error(err.response?.data?.detail || t('products:messages.adjust_error')) }
  }

  const handleStockAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduit) return
    if (!user?.is_superuser && !user?.profile?.can_adjust_stock && !user?.can_adjust_stock) {
        toast.error(t('products:messages.access_denied_adjust')); return;
    }
    setIsAdjustmentModalOpen(false)
    setPasswordModalConfig({
        title: t('products:messages.password_confirm_adjust_title'),
        message: t('products:messages.password_confirm_adjust_body', { 
          name: selectedProduit.name, oldStock: selectedProduit.stock, newStock: adjustmentForm.new_quantity 
        })
    })
    setPendingAction(() => executeStockAdjustment)
    setIsPasswordModalOpen(true)
  }

  const handleBulkDelete = async () => {
    const confirmed = await confirm({
      title: t('products:messages.bulk_delete_title'),
      message: t('products:messages.bulk_delete_body', { count: selectedProductIds.length }),
      variant: 'danger',
      confirmText: t('products:actions.bulk_delete')
    })
    if (!confirmed) return
    setActionLoading(true)
    let successCount = 0
    try {
      for (const id of selectedProductIds) {
        try { await axios.delete(`${produitsEndpoint}${id}/`); successCount++; } catch {}
      }
      if (successCount > 0) { refetchProduits(); setSelectedProductIds([]); toast.success(`${successCount} ${t('products:messages.delete_success')}`); }
    } finally { setActionLoading(false) }
  }

  const handleGenerateLabels = async (produit: ProduitModel) => {
    const qtyStr = prompt(t('products:messages.labels_prompt', { name: produit.name }), "1")
    if (!qtyStr) return
    const quantity = parseInt(qtyStr, 10)
    if (isNaN(quantity) || quantity <= 0) { toast.error(t('products:messages.invalid_quantity')); return; }
    try {
      const resp = await axios.post(`${produitsEndpoint}generate_labels/`, { products: [{ id: produit.id, quantity }] }, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a'); link.href = url; link.setAttribute('download', `etiquettes_${produit.name}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
    } catch (err) { toast.error(t('products:messages.generation_error')) }
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement
      if (activeElement?.tagName === 'TEXTAREA' || (activeElement?.tagName === 'INPUT' && activeElement.getAttribute('type') !== 'text')) return;
      if (e.key === 'Enter' && selectedProduit) { e.preventDefault(); setSelectedProductIds(prev => prev.includes(selectedProduit.id) ? prev.filter(pid => pid !== selectedProduit.id) : [...prev, selectedProduit.id]); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (produits.length === 0) return
        const currentIndex = selectedProduit ? produits.findIndex(p => p.id === selectedProduit.id) : -1
        let newIndex = e.key === 'ArrowDown' ? (currentIndex < produits.length - 1 ? currentIndex + 1 : 0) : (currentIndex > 0 ? currentIndex - 1 : produits.length - 1)
        const newProduit = produits[newIndex]
        if (newProduit) {
          setSelectedProduit(newProduit)
          document.querySelector(`tr[data-product-id="${newProduit.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', handleKeyDown); return () => document.removeEventListener('keydown', handleKeyDown)
  }, [produits, selectedProduit])

  // -- RENDER --
  const lowStockCount = useMemo(() => produits.filter(p => (p.stock ?? 0) <= (p.stock_alert ?? 0) && (p.stock ?? 0) > 0).length, [produits])
  const outOfStockCount = useMemo(() => produits.filter(p => (p.stock ?? 0) <= 0).length, [produits])
  const error = loadError instanceof Error ? loadError.message : (loadError ? String(loadError) : null);

  return (
    <div className="min-h-screen bg-base-200 p-6 space-y-6 font-sans">
      {/* Header Section */}
      <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-3">
              <span className="p-2 bg-primary/10 text-primary rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </span>
              {t('products:title')}
            </h1>
            <p className="text-base-content/60 text-sm mt-1 ml-11">
              {t('products:subtitle', { defaultValue: 'Gérez votre inventaire et vos stocks en temps réel' })}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => recalculateRotationMutation.mutate()} 
              className="btn btn-sm btn-ghost gap-2 font-bold text-base-content/60 hover:text-primary transition-colors"
              title={t('products:actions.rotation')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t('products:actions.rotation')}
            </button>
            <button 
              onClick={() => refetchProduits()} 
              className={`btn btn-sm btn-ghost ${loading ? 'btn-disabled' : ''} text-base-content/60 hover:text-primary transition-colors`}
              disabled={loading}
            >
              {loading ? <span className="loading loading-spinner loading-xs"></span> : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error shadow-sm rounded-xl py-3 border-none bg-error/10 text-error font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Left Panel: List & Actions */}
        <div className="lg:col-span-4 bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-base-200 bg-base-100 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-black text-xs uppercase tracking-widest text-base-content/40">Inventaire</span>
              <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-[10px] font-black">{totalCount}</span>
            </div>
            <button 
              className="btn btn-sm btn-primary rounded-xl px-4 gap-2 shadow-sm shadow-primary/20" 
              onClick={() => setIsCreateModalOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              {t('products:actions.create')}
            </button>
          </div>
          
          <ProductFilters 
            searchQuery={searchQuery} setSearchQuery={setSearchQuery} 
            filterRayon={filterRayon} setFilterRayon={setFilterRayon}
            filterFournisseur={filterFournisseur} setFilterFournisseur={setFilterFournisseur}
            filterExclusive={filterExclusive} setFilterExclusive={setFilterExclusive}
            showInactive={showInactive} setShowInactive={setShowInactive}
          />

          <ProductTable 
            products={produits} selectedProduit={selectedProduit} 
            onViewDetails={handleViewDetails} loading={loading} 
            selectedProductIds={selectedProductIds}
            onSelectProduct={(id) => setSelectedProductIds(prev => prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id])}
            onSelectAll={() => setSelectedProductIds(prev => prev.length === produits.length ? [] : produits.map(p => p.id))}
            onZoom={() => setIsDetailsModalOpen(true)}
          />

          {totalPages > 1 && (
            <div className="p-4 border-t border-base-200 bg-base-50/30">
              <div className="flex justify-between items-center">
                <button 
                  className="btn btn-xs btn-ghost gap-1 font-bold disabled:opacity-30" 
                  disabled={page === 1} 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  {t('common:pagination.prev')}
                </button>
                <span className="text-[10px] font-black text-base-content/40 uppercase tracking-tighter">
                  {t('common:pagination.page_info_simple', { page })} / {totalPages}
                </span>
                <button 
                  className="btn btn-xs btn-ghost gap-1 font-bold disabled:opacity-30" 
                  disabled={page >= totalPages} 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                   {t('common:pagination.next')}
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="p-3 border-t border-base-200 bg-base-100 shrink-0 flex justify-between px-6">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-base-content/30 uppercase tracking-widest">Global</span>
              <span className="text-primary font-black text-sm">{totalCount}</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5" title="Stock Faible">
                <div className="w-2 h-2 rounded-full bg-warning animate-pulse"></div>
                <span className="text-warning font-black text-sm">{lowStockCount}</span>
              </div>
              <div className="flex items-center gap-1.5" title="Rupture">
                <div className="w-2 h-2 rounded-full bg-error"></div>
                <span className="text-error font-black text-sm">{outOfStockCount}</span>
              </div>
            </div>
          </div>

          <BulkActionsBar 
            selectedCount={selectedProductIds.length} rayons={rayons} fournisseurs={fournisseurs} loading={actionLoading}
            onDeselectAll={() => setSelectedProductIds([])}
            onBulkDelete={handleBulkDelete}
            onBulkChangeRayon={() => { /* handleBulkChangeRayon Logic */ }}
            onBulkChangeFournisseur={() => { /* handleBulkChangeFournisseur Logic */ }}
          />
        </div>

        {/* Right Panel: Details */}
        <div className="lg:col-span-8 bg-base-100 rounded-2xl shadow-sm border border-base-300 flex flex-col overflow-hidden">
          <ProductDetailPanel 
            selectedProduit={selectedProduit} detailsLoading={detailsLoading} 
            activeTab={activeTab} setActiveTab={setActiveTab}
            lots={lots} monthlyStats={monthlyStats} 
            achats={achats} loadingAchats={loadingAchats}
            stockHistory={stockHistory} loadingHistory={loadingHistory} transferLoading={transferLoading}
            onMovementClick={handleMovementClick}
            onOpenAdjustment={() => {
              setAdjustmentForm({ new_quantity: String(selectedProduit?.stock || 0), reason_type: 'INVENTAIRE' });
              setIsAdjustmentModalOpen(true);
            }}
            onOpenEdit={handleOpenEditModal}
            onGenerateLabels={handleGenerateLabels}
            onDelete={handleDeleteProduit}
            onToggleActive={handleToggleActive}
            onTransferToRayon={handleTransferToRayon}
          />
        </div>
      </div>

      {/* Modals */}
      <ProductEditModal 
        isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} 
        form={editForm} setForm={setEditForm} onSubmit={handleUpdateProduit}
        rayons={rayons} fournisseurs={fournisseurs} tvaList={tvaList}
      />
      <StockAdjustmentModal 
        isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)}
        selectedProduit={selectedProduit} form={adjustmentForm} setForm={setAdjustmentForm}
        onSubmit={handleStockAdjustmentSubmit}
      />
      <PasswordConfirmModal 
        isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={pendingAction} title={passwordModalConfig.title} message={passwordModalConfig.message}
      />
      <ProduitCreateModal 
        open={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onCreated={() => { refetchProduits(); setIsCreateModalOpen(false); }}
        produitsEndpoint={produitsEndpoint} rayons={rayons} fournisseurs={fournisseurs} formes={formes} groupes={groupes as any}
      />
      <SalesDetailsModal isOpen={showSalesModal} onClose={() => { setShowSalesModal(false); setSelectedFacture(null); }} facture={selectedFacture} loading={loadingFacture} />
      <ProductDetailsModal 
        isOpen={isDetailsModalOpen} 
        onClose={() => setIsDetailsModalOpen(false)}
        selectedProduit={selectedProduit}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lots={lots}
        monthlyStats={monthlyStats}
        achats={achats}
        stockHistory={stockHistory}
        loadingHistory={loadingHistory}
        onMovementClick={handleMovementClick}
        onOpenAdjustment={() => {
          setAdjustmentForm({ new_quantity: String(selectedProduit?.stock || 0), reason_type: 'INVENTAIRE' });
          setIsAdjustmentModalOpen(true);
        }}
        onOpenEdit={handleOpenEditModal}
        onDelete={handleDeleteProduit}
      />
    </div>
  )
}
