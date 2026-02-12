
import { useState, useMemo, useEffect } from 'react' // Keep useEffect for scroll/focus management if needed, but remove data fetching ones
import { useTranslation } from 'react-i18next';
import axios from '../config/axios'
import { toast } from 'react-hot-toast'
import { useConfirm } from '../hooks/useConfirm';
import { useAuth } from '../context/AuthContext';
import PasswordConfirmModal from './PasswordConfirmModal';
import type { ProduitModel } from '../types'
import { STOCK_ADJUSTMENT_REASONS } from '../types'
import ProduitCreateModal from './ProduitFormModal'

import {
  useProduits,
  useRayons,
  useFournisseurs,
  useFormes,
  useGroupes,
  useProduitAchats,
  useProduitLots,
  useProduitAdjustments,
  useProduitStats,
  useProduitHistory,
  useUpdateProduit,
  useAdjustStock,
  useDeleteProduit,
  useRecalculateRotation
} from '../hooks/useProduits';

export default function Produit() {
  // Hook de confirmation
  const confirm = useConfirm()
  const { t } = useTranslation();
  
  const { user } = useAuth();
  
  // Pagination
  const [page, setPage] = useState(1)
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [filterRayon, setFilterRayon] = useState('')
  const [filterFournisseur, setFilterFournisseur] = useState('')
  const [filterExclusive, setFilterExclusive] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  // Debounce de la recherche (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setPage(1) // Reset page on search change
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Queries
  const { 
    data: produitsData, 
    isLoading: loading, 
    error: loadError,
    refetch: refetchProduits
  } = useProduits({
    search: debouncedSearchQuery,
    page: page,
    include_inactive: showInactive
  });

  const { data: rayons = [] } = useRayons();
  const { data: fournisseurs = [] } = useFournisseurs();
  const { data: formes = [] } = useFormes();
  const { data: groupes = [] } = useGroupes();

  // Derived state for pagination and list
  const produits = useMemo(() => produitsData?.results || [], [produitsData]);
  const totalCount = produitsData?.count || 0;
  const limit = 50; // Approximated, ideally comes from API
  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false)
  const [selectedProduit, setSelectedProduit] = useState<ProduitModel | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'prix' | 'achats' | 'lots' | 'ajustements' | 'stats' | 'mouvements'>('general')

  
  // Dependent Queries for Details
  // They automatically run when selectedProduit is set
  const { data: achats = [], isLoading: detailsLoadingAchats } = useProduitAchats(selectedProduit?.id || null);
  const { data: lots = [], isLoading: detailsLoadingLots } = useProduitLots(selectedProduit?.id || null);
  const { data: adjustments = [], isLoading: detailsLoadingAdjustments } = useProduitAdjustments(selectedProduit?.id || null);
  const { data: monthlyStats = [], isLoading: detailsLoadingStats } = useProduitStats(selectedProduit?.id || null);
  const { data: stockHistory = [], isLoading: loadingHistory } = useProduitHistory(selectedProduit?.id || null, activeTab);

  const detailsLoading = detailsLoadingAchats || detailsLoadingLots || detailsLoadingAdjustments || detailsLoadingStats;
  
  // Mutations
  const updateProduitMutation = useUpdateProduit();
  const deleteProduitMutation = useDeleteProduit();
  const adjustStockMutation = useAdjustStock();
  const recalculateRotationMutation = useRecalculateRotation();

  // Formulaire d'édition
  const [editForm, setEditForm] = useState({
    name: '',
    stock: '',
    cost_price: '',
    selling_price: '',
    cip1: '',
    cip2: '',
    cip3: '',
    expire_date: '',
    stock_alert: '',
    stock_minimum: '',
    stock_maximum: '',
    tva: '19.25',
    rayon: '',
    fournisseur: '',
    forme: '',
    use_lot_management: true,  // Default to true
    requires_prescription: false,
    surveillance_category: 'NONE',
    is_supplier_exclusive: false
  })
  
  // Formulaire d'ajustement de stock
  const [adjustmentForm, setAdjustmentForm] = useState({
    new_quantity: '',
    reason_type: 'INVENTAIRE'
  })
  
  // Sélection pour suppression groupée
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])

  // Sudo Mode State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordModalConfig, setPasswordModalConfig] = useState<{ title: string; message: string }>({ title: '', message: '' });
  const [pendingAction, setPendingAction] = useState<() => Promise<void>>(() => Promise.resolve());

  const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL ?? ''), [])
  const produitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/produits/` : '/api/produits/'
  const rayonsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/categories/` : '/api/categories/'
  const fournisseursEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/fournisseurs/` : '/api/fournisseurs/'

  // Removed manual fetch effects


  // State for manual actions (bulk delete, etc.)
  const [actionLoading, setActionLoading] = useState(false);

  /* Removed fetchProduits and fetchRayonsAndFournisseurs as they are replaced by React Query */

  const handleViewDetails = (produit: ProduitModel) => {
    setSelectedProduit(produit)
    // Note: On ne réinitialise plus l'onglet actif pour préserver la navigation utilisateur
    // Data fetching is now automatic via hooks
  }

  const handleGenerateLabels = async (produit: ProduitModel) => {
    const quantityStr = prompt(t('products.messages.labels_prompt', { name: produit.name }), "1")
    if (!quantityStr) return
    
    const quantity = parseInt(quantityStr, 10)
    if (isNaN(quantity) || quantity <= 0) {
      toast.error(t('products.messages.invalid_quantity'))
      return
    }

    try {
      const response = await axios.post(`${produitsEndpoint}generate_labels/`, {
        products: [{ id: produit.id, quantity }]
      }, { responseType: 'blob' })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `etiquettes_${produit.name}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      console.error('Erreur génération étiquettes:', err)
      toast.error(t('products.messages.generation_error'))
    }
  }

  const executeDeleteProduit = async (produitId: number) => {
    try {
      await deleteProduitMutation.mutateAsync(produitId);
      setSelectedProduit(null)
      toast.success(t('products.messages.delete_success'))
    } catch (err) {
      toast.error('Erreur lors de la suppression')
      console.error(err)
    }
  }

  const handleDeleteProduit = async (produit: ProduitModel) => {
    // Permission Check
    if (!user?.is_superuser && !user?.can_delete_product) {
        toast.error(t('products.messages.access_denied_delete'))
        return
    }

    const confirmed = await confirm({
      title: t('products.messages.delete_confirm_title'),
      message: t('products.messages.delete_confirm_body', { name: produit.name }),
      variant: 'danger',
      confirmText: t('products.actions.delete')
    })
    if (!confirmed) return
    
    // Trigger Password Modal
    setPasswordModalConfig({
        title: t('products.messages.password_confirm_delete_title'),
        message: t('products.messages.password_confirm_delete_body')
    })
    setPendingAction(() => () => executeDeleteProduit(produit.id))
    setIsPasswordModalOpen(true)
  }

  const handleRecalculateRotation = async () => {
    const confirmed = await confirm({
      title: t('products.messages.recalculate_title'),
      message: t('products.messages.recalculate_body'),
      variant: 'info',
      confirmText: t('products.actions.recalculate_confirm') || 'Recalculer'
    })
    if (!confirmed) return
    
    setActionLoading(true)
    try {
      await recalculateRotationMutation.mutateAsync();
      toast.success(t('products.messages.recalculate_success'))
      refetchProduits();
    } catch (err) {
      toast.error('Erreur lors du recalcul')
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleToggleActive = async (produit: ProduitModel) => {
    try {
      const response = await axios.post(`${produitsEndpoint}${produit.id}/toggle_active/`)
      const isActive = response.data.is_active
      toast.success(isActive ? 'Produit réactivé' : 'Produit masqué')
      // Update local state
      setSelectedProduit(prev => prev ? ({ ...prev, is_active: isActive }) : null)
      refetchProduits()
    } catch (err) {
      toast.error('Erreur lors du changement de statut')
      console.error(err)
    }
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
      is_supplier_exclusive: produit.is_supplier_exclusive ?? false
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateProduit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduit) return
    
    const newStock = parseInt(editForm.stock || '0', 10)
    if (newStock !== selectedProduit.stock) {
      toast.error('⚠️ ' + t('products.messages.stock_update_warning'), { duration: 6000 })
      setEditForm(prev => ({ ...prev, stock: String(selectedProduit.stock) }))
      return
    }
    
    try {
      const payload = {
        name: editForm.name.trim().toUpperCase(),
        description: '',
        cost_price: editForm.cost_price.trim(),
        selling_price: editForm.selling_price.trim(),
        cip1: editForm.cip1.trim() || null,
        cip2: editForm.cip2.trim() || null,
        cip3: editForm.cip3.trim() || null,
        expire_date: editForm.expire_date.trim() || null,
        stock_alert: parseInt(editForm.stock_alert || '0', 10),
        stock_minimum: parseInt(editForm.stock_minimum || '0', 10),
        stock_maximum: parseInt(editForm.stock_maximum || '0', 10),
        tva: editForm.tva || '19.25',
        rayon: editForm.rayon ? parseInt(editForm.rayon, 10) : null,
        fournisseur: editForm.fournisseur ? parseInt(editForm.fournisseur, 10) : null,
        forme: editForm.forme ? parseInt(editForm.forme, 10) : null,
        use_lot_management: editForm.use_lot_management,
        requires_prescription: editForm.requires_prescription || false,
        surveillance_category: (editForm.surveillance_category || 'NONE') as "NONE" | "STANDARD" | "RENFORCEE",
        is_supplier_exclusive: editForm.is_supplier_exclusive
      }
      
      const updatedProduit = await updateProduitMutation.mutateAsync({ id: selectedProduit.id, data: payload })
      setSelectedProduit(updatedProduit)
      setIsEditModalOpen(false)
      toast.success(t('products.messages.update_success'))
    } catch (err) {
      toast.error('Erreur lors de la mise à jour')
      console.error(err)
    }
  }

  const handleProduitCreated = () => {
    // React Query automatically invalidates 'produits' on create success if setup correctly in component using useCreateProduit
    // Or we manually refetch
    refetchProduits();
    setIsCreateModalOpen(false)
  }

  const executeStockAdjustment = async () => {
    if (!selectedProduit) return

    try {
      const data = await adjustStockMutation.mutateAsync({
        id: selectedProduit.id,
        quantity: parseInt(adjustmentForm.new_quantity),
        reason: adjustmentForm.reason_type
      });
      
      toast.success(`Stock ajusté: ${data.quantity_change >= 0 ? '+' : ''}${data.quantity_change}`)
      
      // Update selected product display locally or wait for cache
      setSelectedProduit(prev => prev ? ({ ...prev, stock: data.quantity_after }) : null)
      
      setIsAdjustmentModalOpen(false)
      setAdjustmentForm({ new_quantity: '', reason_type: 'INVENTAIRE' })
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'ajustement')
      console.error(err)
    }
  }

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduit) return

    // Permission Check
    if (!user?.is_superuser && !user?.can_adjust_stock) {
        toast.error(t('products.messages.access_denied_adjust'))
        return
    }
    
    if (!adjustmentForm.new_quantity) {
      toast.error(t('products.messages.input_quantity_error'))
      return
    }
    
    setIsAdjustmentModalOpen(false)
    
    setPasswordModalConfig({
        title: t('products.messages.password_confirm_adjust_title'),
        message: t('products.messages.password_confirm_adjust_body', { 
          name: selectedProduit.name, 
          oldStock: selectedProduit.stock, 
          newStock: adjustmentForm.new_quantity 
        })
    })
    setPendingAction(() => executeStockAdjustment)
    setIsPasswordModalOpen(true)
  }

  const handleOpenAdjustmentModal = () => {
    if (selectedProduit) {
      setAdjustmentForm({
        new_quantity: String(selectedProduit.stock),
        reason_type: 'INVENTAIRE'
      })
      setIsAdjustmentModalOpen(true)
    }
  }

  /* ... handleStockAdjustment ... */

  // Gestion de la sélection pour suppression groupée
  const handleSelectProduct = (id: number) => {
    setSelectedProductIds(prev =>
      prev.includes(id)
        ? prev.filter(pid => pid !== id)
        : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedProductIds.length === filteredProduits.length) {
      setSelectedProductIds([])
    } else {
      setSelectedProductIds(filteredProduits.map(p => p.id))
    }
  }

  const handleBulkDelete = async () => {
    const confirmed = await confirm({
      title: t('products.messages.bulk_delete_title'),
      message: t('products.messages.bulk_delete_body', { count: selectedProductIds.length }),
      variant: 'danger',
      confirmText: t('products.actions.bulk_delete')
    })
    if (!confirmed) return
    
    setActionLoading(true)
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []
    
    try {
      for (const id of selectedProductIds) {
        try {
          await axios.delete(`${produitsEndpoint}${id}/`)
          successCount++
        } catch (err: any) {
             errorCount++
             errors.push(`#${id}: ${err.message}`)
        }
      }
      
      if (successCount > 0) {
        refetchProduits()
        setSelectedProductIds([])
      }
      
      if (successCount > 0 && errorCount === 0) {
        toast.success(`${successCount} ${t('products.messages.delete_success')}`) // Simplified
      } else {
        toast(`${successCount} supprimé(s), ${errorCount} échec(s)`, { icon: '⚠️' })
      }
    } catch (err) {
      toast.error('Erreur lors de la suppression groupée')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBulkChangeRayon = async (rayonId: number) => {
    const rayonName = rayons.find(r => r.id === rayonId)?.name || 'sélectionné'
    const confirmed = await confirm({
      title: t('products.messages.bulk_rayon_change_title'),
      message: t('products.messages.bulk_rayon_change_body', { count: selectedProductIds.length, name: rayonName }),
      variant: 'info',
      confirmText: t('products.actions.confirm')
    })
    if (!confirmed) return

    setActionLoading(true)
    let successCount = 0

    try {
      for (const id of selectedProductIds) {
        try {
          await axios.patch(`${produitsEndpoint}${id}/`, { rayon: rayonId })
          successCount++
        } catch {}
      }

      if (successCount > 0) {
        toast.success(t('products.messages.bulk_update_success', { count: successCount }))
        refetchProduits()
        setSelectedProductIds([])
      }
    } catch (err) {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBulkChangeFournisseur = async (fournisseurId: number) => {
    const fournisseurName = fournisseurs.find(f => f.id === fournisseurId)?.name || 'sélectionné'
    const confirmed = await confirm({
      title: t('products.messages.bulk_provider_change_title'),
      message: t('products.messages.bulk_provider_change_body', { count: selectedProductIds.length, name: fournisseurName }),
      variant: 'info',
      confirmText: t('products.actions.confirm')
    })
    if (!confirmed) return

    setActionLoading(true)
    let successCount = 0

    try {
      for (const id of selectedProductIds) {
        try {
          await axios.patch(`${produitsEndpoint}${id}/`, { fournisseur: fournisseurId })
          successCount++
        } catch {}
      }

      if (successCount > 0) {
        toast.success(t('products.messages.bulk_update_success', { count: successCount }))
        refetchProduits()
        setSelectedProductIds([])
      }
    } catch (err) {
      toast.error('Erreur lors de la mise à jour')
    } finally {
      setActionLoading(false)
    }
  }

  // Filtrer les produits
  const filteredProduits = useMemo(() => {
    // Ensure produits is always an array
    if (!Array.isArray(produits)) return [];
    
    let list = produits
    
    if (debouncedSearchQuery) {
        // Server-side filtered already, but we might want to keep highlighting or secondary local filter
        // For now, we trust server results, no additional name filtering needed locally if server does it.
        // But if filtering by Rayon/Fournisseur (which are local for now), we keep that.
    }
    
    if (filterRayon) {
      list = list.filter(p => (p.rayon_name || '').toLowerCase() === filterRayon.toLowerCase())
    }
    
    if (filterFournisseur) {
      list = list.filter(p => (p.fournisseur_name || '').toLowerCase() === filterFournisseur.toLowerCase())
    }

    if (filterExclusive) {
      list = list.filter(p => p.is_supplier_exclusive)
    }
    
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [produits, debouncedSearchQuery, filterRayon, filterFournisseur, filterExclusive])

  // Navigation clavier avec flèches haut/bas et Entrée pour sélection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si un input/textarea est focus (sauf si c'est la recherche)
      const activeElement = document.activeElement as HTMLElement
      if (activeElement?.tagName === 'TEXTAREA' || 
          (activeElement?.tagName === 'INPUT' && activeElement.getAttribute('type') !== 'text')) {
        return
      }

      // Entrée pour sélectionner/désélectionner le produit courant
      if (e.key === 'Enter' && selectedProduit) {
        e.preventDefault()
        handleSelectProduct(selectedProduit.id)
        return
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        
        if (filteredProduits.length === 0) return

        const currentIndex = selectedProduit 
          ? filteredProduits.findIndex(p => p.id === selectedProduit.id)
          : -1

        let newIndex: number
        if (e.key === 'ArrowDown') {
          newIndex = currentIndex < filteredProduits.length - 1 ? currentIndex + 1 : 0
        } else {
          newIndex = currentIndex > 0 ? currentIndex - 1 : filteredProduits.length - 1
        }

        const newProduit = filteredProduits[newIndex]
        if (newProduit) {
          handleViewDetails(newProduit)
          
          // Scroll to make the selected row visible
          const row = document.querySelector(`tr[data-product-id="${newProduit.id}"]`)
          row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredProduits, selectedProduit, selectedProductIds])

  // Stats
  const totalProduits = Array.isArray(produits) ? produits.length : 0
  const lowStockCount = useMemo(() => Array.isArray(produits) ? produits.filter(p => (p.stock ?? 0) <= (p.stock_alert ?? 0) && (p.stock ?? 0) > 0).length : 0, [produits])
  const outOfStockCount = useMemo(() => Array.isArray(produits) ? produits.filter(p => (p.stock ?? 0) <= 0).length : 0, [produits])

  // Setup derived error message
  const error = loadError instanceof Error ? loadError.message : (loadError ? String(loadError) : null);

  // Safety check - if produits is somehow not an array, show loading
  if (!Array.isArray(produits)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-base-content/70">{t('products.messages.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Header compact */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">📦 {t('products.title')}</h1>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleRecalculateRotation}
            className="btn btn-xs btn-ghost"
            disabled={actionLoading}
            title={t('products.actions.rotation')}
          >
            🔄 {t('products.actions.rotation')}
          </button>
          <button
            onClick={() => refetchProduits()}
            className="btn btn-xs btn-ghost"
            disabled={loading || actionLoading}
            title={t('products.actions.refresh')}
          >
            {loading || actionLoading ? <span className="loading loading-spinner loading-xs"></span> : '🔄'}
          </button>
        </div>
      </div>

      {/* Messages d'erreur */}
      {error && (
        <div className="shrink-0">
          <div role="alert" className="alert alert-error alert-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Layout Split-Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1 min-h-0">
        {/* Left Panel: Liste des produits */}
        <div className="md:col-span-1 bg-white rounded-lg shadow flex flex-col overflow-hidden">
          {/* Header avec recherche et actions */}
          <div className="p-3 border-b bg-white shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-800">{t('products.table.product')}s</h2>
                {loading ? (
                  <span className="loading loading-spinner loading-xs text-primary"></span>
                ) : (
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{totalCount}</span>
                )}
              </div>
              <div className="flex gap-2">

                <button className="btn btn-sm btn-primary gap-2" onClick={() => setIsCreateModalOpen(true)}>
                  ➕ {t('products.actions.create')}
                </button>
              </div>
            </div>
            
            {/* Recherche */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder={t('products.filters.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-xs input-bordered w-full pl-7 bg-slate-50 focus:bg-white h-7 text-xs"
              />
            </div>

            {/* Filtres compacts */}
            <div className="flex gap-1">
              <select
                value={filterRayon}
                onChange={(e) => setFilterRayon(e.target.value)}
                className="select select-xs select-bordered flex-1 min-w-0 text-xs h-7"
              >
                <option value="">{t('products.filters.rayon_placeholder')}</option>
                {rayons.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              <select
                value={filterFournisseur}
                onChange={(e) => setFilterFournisseur(e.target.value)}
                className="select select-xs select-bordered flex-1 min-w-0 text-xs h-7"
              >
                <option value="">{t('products.filters.provider_placeholder')}</option>
                {fournisseurs.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
              </select>
              
              <button
                className={`btn btn-xs h-7 w-7 btn-square ${filterExclusive ? 'btn-active btn-warning' : 'btn-ghost'}`}
                onClick={() => setFilterExclusive(!filterExclusive)}
                title="Afficher uniquement les produits exclusifs"
              >
                🔒
              </button>

              <button
                className={`btn btn-xs h-7 w-7 btn-square ${showInactive ? 'btn-active btn-neutral' : 'btn-ghost'}`}
                onClick={() => setShowInactive(!showInactive)}
                title={showInactive ? "Masquer les produits inactifs" : "Afficher les produits inactifs"}
              >
                {showInactive ? '👁️' : '🙈'}
              </button>

              {(searchQuery || filterRayon || filterFournisseur || filterExclusive || showInactive) && (
                <button
                  className="btn btn-xs btn-ghost btn-square"
                  onClick={() => {
                    setSearchQuery('')
                    setFilterRayon('')
                    setFilterFournisseur('')
                    setFilterExclusive(false)
                    setShowInactive(false)
                  }}
                  title={t('products.actions.reset')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Tableau compact */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <span className="loading loading-spinner loading-md"></span>
              </div>
            ) : filteredProduits.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4">
                <span className="text-xl">📭</span>
                <span className="text-xs mt-1">{t('products.table.empty')}</span>
              </div>
            ) : (
              <table className="table table-xs table-pin-rows w-full">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="py-1.5 px-1 w-6">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs checkbox-primary"
                        checked={selectedProductIds.length === filteredProduits.length && filteredProduits.length > 0}
                        onChange={handleSelectAll}
                        title="Tout sélectionner"
                      />
                    </th>
                    <th className="py-1.5 px-2 font-semibold uppercase text-[9px] tracking-wider w-20">CIP</th>
                    <th className="py-1.5 px-2 font-semibold uppercase text-[9px] tracking-wider">Produit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProduits.map((produit) => {
                    const stock = produit.stock ?? 0;
                    const isSelected = selectedProduit?.id === produit.id;
                    const isChecked = selectedProductIds.includes(produit.id);
                    
                    return (
                      <tr
                        key={produit.id}
                        data-product-id={produit.id}
                        className={`hover cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-primary/20 border-l-4 border-l-primary font-semibold' 
                            : isChecked 
                              ? 'bg-success/10 border-l-4 border-l-success' 
                              : 'border-b border-slate-50 text-slate-600'
                        } ${stock < 0 ? 'text-error' : stock === 0 ? 'opacity-60' : ''}`}
                        onClick={() => handleViewDetails(produit)}
                      >
                        <td className="py-1 px-1 w-6" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs checkbox-primary"
                            checked={isChecked}
                            onChange={() => handleSelectProduct(produit.id)}
                          />
                        </td>
                        <td className="py-1 px-2 w-20">
                          <span className="font-mono text-xs text-slate-600 font-semibold">{produit.cip1 || '-'}</span>
                        </td>
                        <td className="py-1 px-2">
                          <div 
                            className={`text-xs uppercase flex items-center flex-wrap gap-1 ${
                              stock < 0 ? 'text-error font-bold' : 
                              stock === 0 ? 'text-slate-400 font-normal' : 
                              'text-slate-800 font-bold'
                            }`} 
                            title={produit.name}
                          >
                            <span>{produit.name}</span>
                            {produit.is_supplier_exclusive && (
                                <div 
                                    className="tooltip tooltip-right z-50 inline-flex shrink-0" 
                                    data-tip={`Exclusivité: ${produit.fournisseur_name || 'Fournisseur Spécifique'}`}
                                >
                                    <span className="badge badge-success badge-sm font-bold text-white w-5 h-5 p-0 flex items-center justify-center text-[10px]">
                                      E
                                    </span>
                                </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center p-2 border-t bg-slate-50 gap-2 items-center text-xs">
              <button 
                className="btn btn-xs btn-ghost" 
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ←
              </button>
              <span className="opacity-70">
                Page {page} / {totalPages}
              </span>
              <button 
                className="btn btn-xs btn-ghost"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                →
              </button>
            </div>
          )}

          {/* Footer stats */}
          <div className="p-1.5 border-t bg-slate-50/50 text-[10px] text-center text-slate-400 shrink-0 flex justify-around">
            <span>📦 {totalProduits}</span>
            <span className="text-warning">⚠️ {lowStockCount}</span>
            <span className="text-error">🚫 {outOfStockCount}</span>
          </div>
          
          {/* Actions groupées */}
          {selectedProductIds.length > 0 && (
            <div className="p-2 border-t bg-primary/5 shrink-0 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-primary">
                <span>✓ {selectedProductIds.length} {t('products.actions.selected')}</span>
                <button 
                  className="btn btn-xs btn-ghost"
                  onClick={() => setSelectedProductIds([])}
                  title={t('products.actions.deselect')}
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-1 flex-wrap">
                <div className="dropdown dropdown-top dropdown-end">
                  <label tabIndex={0} className="btn btn-xs btn-outline btn-primary gap-1">
                    📁 {t('products.actions.bulk_rayon')} ▼
                  </label>
                  <ul tabIndex={0} className="dropdown-content z-50 menu p-1 shadow bg-base-100 rounded-box w-40 max-h-48 overflow-auto">
                    {rayons.map(r => (
                      <li key={r.id}>
                        <a onClick={() => handleBulkChangeRayon(r.id)} className="text-xs py-1">{r.name}</a>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="dropdown dropdown-top dropdown-end">
                  <label tabIndex={0} className="btn btn-xs btn-outline btn-secondary gap-1">
                    🏭 {t('products.actions.bulk_provider')} ▼
                  </label>
                  <ul tabIndex={0} className="dropdown-content z-50 menu p-1 shadow bg-base-100 rounded-box w-48 max-h-48 overflow-auto">
                    {fournisseurs.map(f => (
                      <li key={f.id}>
                        <a onClick={() => handleBulkChangeFournisseur(f.id)} className="text-xs py-1">{f.name}</a>
                      </li>
                    ))}
                  </ul>
                </div>
                <button 
                  className="btn btn-xs btn-error gap-1" 
                  onClick={handleBulkDelete}
                  disabled={loading}
                >
                  🗑️ {t('products.actions.bulk_delete')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Détails du produit */}
        <div className="md:col-span-2 bg-white rounded-lg shadow flex flex-col overflow-hidden">
          {detailsLoading ? (
             <div className="flex items-center justify-center h-full">
               <span className="loading loading-spinner loading-lg"></span>
             </div>
          ) : selectedProduit ? (
            <div className="flex flex-col h-full">
              {/* Header produit */}
              <div className="p-4 border-b bg-gradient-to-r from-slate-50 to-white shrink-0">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold uppercase">#{selectedProduit.id}</span>
                      <span className={`badge badge-md ${
                        (selectedProduit.stock ?? 0) <= 0 ? 'badge-error' :
                        (selectedProduit.stock ?? 0) <= (selectedProduit.stock_alert ?? 0) ? 'badge-warning' :
                        'badge-success'
                      }`}>{t('products.table.stock')}: {selectedProduit.stock ?? 0}</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase">{selectedProduit.name}</h2>
                    <p className="text-sm text-slate-500 font-mono mt-1">
                      {t('products.detail.cip')}: {selectedProduit.cip1 || '-'} / {selectedProduit.cip2 || '-'} / {selectedProduit.cip3 || '-'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      className="btn btn-sm btn-ghost text-slate-400 hover:text-warning" 
                      onClick={handleOpenAdjustmentModal}
                      title={t('products.actions.adjust_stock')}
                    >
                      📊
                    </button>
                    <button 
                      className="btn btn-sm btn-ghost text-slate-400 hover:text-primary" 
                      onClick={() => handleOpenEditModal(selectedProduit)}
                      title={t('products.actions.edit')}
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn btn-sm btn-ghost text-slate-400 hover:text-secondary" 
                      onClick={() => handleGenerateLabels(selectedProduit)}
                      title={t('products.actions.labels')}
                    >
                      🏷️
                    </button>
                    <button 
                      className="btn btn-sm btn-ghost text-slate-400 hover:text-error" 
                      onClick={() => handleDeleteProduit(selectedProduit)}
                      title={t('products.actions.delete')}
                    >
                      🗑️
                    </button>
                    <button 
                      className={`btn btn-sm btn-ghost ${selectedProduit.is_active === false ? 'text-warning' : 'text-slate-400 hover:text-warning'}`}
                      onClick={() => handleToggleActive(selectedProduit)}
                      title={selectedProduit.is_active === false ? 'Réactiver le produit' : 'Masquer le produit'}
                    >
                      {selectedProduit.is_active === false ? '👁️' : '🙈'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Onglets */}
              <div role="tablist" className="tabs tabs-boxed bg-slate-100 rounded-none px-4 pt-2 shrink-0">
                <a role="tab" className={`tab ${activeTab === 'general' ? 'tab-active' : ''}`} onClick={() => setActiveTab('general')}>
                  {t('products.detail.tabs.general')}
                </a>
                <a role="tab" className={`tab ${activeTab === 'prix' ? 'tab-active' : ''}`} onClick={() => setActiveTab('prix')}>
                  {t('products.detail.tabs.price')}
                </a>
                <a role="tab" className={`tab ${activeTab === 'achats' ? 'tab-active' : ''}`} onClick={() => setActiveTab('achats')}>
                  {t('products.detail.tabs.purchases')}
                </a>
                <a role="tab" className={`tab ${activeTab === 'lots' ? 'tab-active' : ''}`} onClick={() => setActiveTab('lots')}>
                  {t('products.detail.tabs.lots')}
                </a>
                <a role="tab" className={`tab ${activeTab === 'ajustements' ? 'tab-active' : ''}`} onClick={() => setActiveTab('ajustements')}>
                  {t('products.detail.tabs.adjustments')}
                </a>
                <a role="tab" className={`tab ${activeTab === 'stats' ? 'tab-active' : ''}`} onClick={() => setActiveTab('stats')}>
                  {t('products.detail.tabs.stats')}
                </a>
                <a role="tab" className={`tab ${activeTab === 'mouvements' ? 'tab-active' : ''}`} onClick={() => setActiveTab('mouvements')}>
                  📜 {t('products.detail.tabs.movements')}
                </a>
              </div>

              {/* Contenu des onglets */}
              <div className="flex-1 overflow-auto p-4">
                {activeTab === 'general' && (
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <tbody>
                        <tr>
                          <td className="font-semibold w-1/3">{t('products.detail.general.description')}</td>
                          <td className="uppercase">{selectedProduit.description || '-'}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">{t('products.detail.general.rayon')}</td>
                          <td><span className="badge badge-outline badge-sm">{selectedProduit.rayon_name || '-'}</span></td>
                        </tr>
                        <tr>
                          <td className="font-semibold">{t('products.detail.general.provider')}</td>
                          <td><span className="badge badge-ghost badge-sm">{selectedProduit.fournisseur_name || '-'}</span></td>
                        </tr>
                        <tr>
                          <td className="font-semibold">{t('products.detail.general.min_max')}</td>
                          <td>{selectedProduit.stock_minimum ?? 0} / {selectedProduit.stock_maximum ?? 0}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">{t('products.detail.general.alert_threshold')}</td>
                          <td><span className="badge badge-warning badge-sm">{selectedProduit.stock_alert ?? 0}</span></td>
                        </tr>
                        <tr>
                          <td className="font-semibold">{t('products.detail.general.expiration')}</td>
                          <td>{selectedProduit.expire_date ? (() => {
                            const d = new Date(selectedProduit.expire_date);
                            return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
                          })() : '-'}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">{t('products.detail.general.last_purchase')}</td>
                          <td>{selectedProduit.dernier_achat ? new Date(selectedProduit.dernier_achat).toLocaleDateString('fr-FR') : '-'}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">{t('products.detail.general.last_sale')}</td>
                          <td>{selectedProduit.dernier_vente ? new Date(selectedProduit.dernier_vente).toLocaleDateString('fr-FR') : '-'}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">{t('products.detail.general.lot_management')}</td>
                          <td>{selectedProduit.use_lot_management ? `✅ ${t('products.detail.general.enabled')}` : `❌ ${t('products.detail.general.disabled')}`}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">{t('products.detail.general.prescription')}</td>
                          <td>{selectedProduit.requires_prescription ? `✅ ${t('products.detail.general.yes')}` : `❌ ${t('products.detail.general.no')}`}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">{t('products.detail.general.surveillance')}</td>
                          <td>{selectedProduit.surveillance_category === 'NONE' ? '-' : selectedProduit.surveillance_category}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'prix' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
                      <div className="stat-title text-sm">{t('products.detail.price.cost')}</div>
                      <div className="stat-value text-blue-600 text-xl">{Math.round(Number(selectedProduit.cost_price || 0)).toLocaleString('fr-FR')} F</div>
                    </div>
                    <div className="stat bg-primary text-primary-content rounded-xl p-4">
                      <div className="stat-title text-primary-content/80 text-sm">{t('products.detail.price.selling')}</div>
                      <div className="stat-value text-xl">{Math.round(Number(selectedProduit.selling_price || 0)).toLocaleString('fr-FR')} F</div>
                    </div>
                    <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
                      <div className="stat-title text-sm">{t('products.detail.price.vat')}</div>
                      <div className="stat-value text-lg">{selectedProduit.tva || '19.25'}%</div>
                    </div>
                    <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
                      <div className="stat-title text-sm">{t('products.detail.price.margin_percent')}</div>
                      <div className="stat-value text-lg">{Number(selectedProduit.pourcentage_marge || 0).toFixed(2)}%</div>
                    </div>
                    <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
                      <div className="stat-title text-sm">{t('products.detail.price.margin_coeff')}</div>
                      <div className="stat-value text-lg">{Number(selectedProduit.taux_marge || 0).toFixed(2)}</div>
                    </div>
                    <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
                      <div className="stat-title text-sm">{t('products.detail.price.rotation')}</div>
                      <div className="stat-value text-lg">{Number(selectedProduit.rotation_moyenne || 0).toFixed(2)}<span className="text-sm"> {t('products.detail.price.per_month')}</span></div>
                    </div>
                  </div>
                )}

                {activeTab === 'achats' && (
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>{t('products.detail.purchases.date')}</th>
                          <th>{t('products.detail.purchases.provider')}</th>
                          <th className="text-right">{t('products.detail.purchases.qty')}</th>
                          <th className="text-right">{t('products.detail.purchases.price')}</th>
                          <th>{t('products.detail.purchases.lot')}</th>
                          <th>{t('products.detail.purchases.exp')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {achats.length === 0 ? (
                          <tr><td colSpan={6} className="text-center text-base-content/50">{t('products.detail.purchases.empty')}</td></tr>
                        ) : (
                          achats.map(a => (
                            <tr key={a.id}>
                              <td className="font-mono text-xs">{a.commande_date?.slice(0, 10) || '-'}</td>
                              <td className="uppercase text-xs">{a.fournisseur_name || '-'}</td>
                              <td className="text-right font-bold">{a.quantity}</td>
                              <td className="text-right">{a.price} F</td>
                              <td className="font-mono text-xs">{a.lot || '-'}</td>
                              <td className="font-mono text-xs">{a.date_expiration ? (() => {
                                const d = new Date(a.date_expiration);
                                return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
                              })() : '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'lots' && (
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>{t('products.detail.lots.lot')}</th>
                          <th>{t('products.detail.lots.expiration')}</th>
                          <th className="text-right">{t('products.detail.lots.stock')}</th>
                          <th className="text-right">{t('products.detail.lots.price')}</th>
                          <th>{t('products.detail.lots.status')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lots.length === 0 ? (
                          <tr><td colSpan={5} className="text-center text-base-content/50">{t('products.detail.lots.empty')}</td></tr>
                        ) : (
                          lots.map(lot => {
                            const expirationDate = lot.date_expiration ? new Date(lot.date_expiration) : null
                            const today = new Date()
                            const isExpired = expirationDate ? expirationDate < today : false
                            const monthsDiff = expirationDate 
                              ? (expirationDate.getFullYear() - today.getFullYear()) * 12 + expirationDate.getMonth() - today.getMonth()
                              : 999
                            const isExpiringSoon = monthsDiff <= 3 && monthsDiff >= 0
                            
                            return (
                              <tr key={lot.id} className={lot.quantity_remaining === 0 ? 'opacity-50' : ''}>
                                <td className="font-mono font-bold">{lot.lot || 'N/A'}</td>
                                <td>
                                  {expirationDate ? (
                                    <span className={isExpired ? 'text-error font-bold' : isExpiringSoon ? 'text-warning font-semibold' : ''}>
                                      {`${(expirationDate.getMonth() + 1).toString().padStart(2, '0')}/${expirationDate.getFullYear().toString().slice(-2)}`}
                                      {isExpired && ' ⚠️'}
                                      {isExpiringSoon && !isExpired && ' ⏰'}
                                    </span>
                                  ) : 'N/A'}
                                </td>
                                <td className="text-right font-bold">
                                  <span className={lot.quantity_remaining === 0 ? 'text-error' : 'text-success'}>
                                    {lot.quantity_remaining}
                                  </span>
                                </td>
                                <td className="text-right">{lot.selling_price} F</td>
                                <td>
                                  {lot.quantity_remaining === 0 ? (
                                    <span className="badge badge-error badge-xs">{t('products.detail.lots.exhausted')}</span>
                                  ) : (
                                    <span className="badge badge-success badge-xs">{t('products.detail.lots.available')}</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'ajustements' && (
                  <div className="overflow-x-auto">
                    {adjustments.length === 0 ? (
                      <p className="text-center text-base-content/50 py-4">{t('products.detail.adjustments.empty')}</p>
                    ) : (
                      <table className="table table-sm">
                        <thead>
                          <tr className="bg-base-200">
                            <th>{t('products.detail.adjustments.date')}</th>
                            <th>{t('products.detail.adjustments.user')}</th>
                            <th className="text-right">{t('products.detail.adjustments.before')}</th>
                            <th className="text-right">{t('products.detail.adjustments.after')}</th>
                            <th className="text-center">{t('products.detail.adjustments.delta')}</th>
                            <th>{t('products.detail.adjustments.reason')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adjustments.map(adj => (
                            <tr key={adj.id}>
                              <td className="text-xs">
                                {new Date(adj.created_at).toLocaleDateString('fr-FR')}
                              </td>
                              <td className="text-xs">{adj.user_name || adj.username || '-'}</td>
                              <td className="text-right">{adj.quantity_before}</td>
                              <td className="text-right">{adj.quantity_after}</td>
                              <td className="text-center">
                                <span className={`badge badge-xs ${adj.quantity_change > 0 ? 'badge-success' : adj.quantity_change < 0 ? 'badge-error' : 'badge-ghost'}`}>
                                  {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
                                </span>
                              </td>
                              <td>
                                <span className="badge badge-outline badge-xs">{adj.reason_type_display}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === 'stats' && (
                  <div className="overflow-x-auto max-h-80">
                    {monthlyStats.length === 0 ? (
                      <p className="text-center text-base-content/50 py-4">{t('products.detail.stats.empty')}</p>
                    ) : (
                      <>
                        <table className="table table-sm">
                          <thead className="bg-base-200 sticky top-0">
                            <tr>
                              <th className="text-xs uppercase"></th>
                              <th className="text-xs uppercase">{t('products.detail.stats.month')}</th>
                              <th className="text-xs uppercase text-right text-primary">{t('products.detail.stats.qty_sold')}</th>
                              <th className="text-xs uppercase text-right text-warning">{t('products.detail.stats.qty_ordered')}</th>
                              <th className="text-xs uppercase text-right text-info">{t('products.detail.stats.nb_clients')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              let currentYear: number | null = null;
                              return monthlyStats.map((stat, index) => {
                                const showYear = stat.year !== currentYear;
                                currentYear = stat.year;
                                return (
                                  <tr key={index} className={showYear ? 'border-t-2 border-base-300' : ''}>
                                    <td className="font-bold text-base-content/60">
                                      {showYear ? stat.year : ''}
                                    </td>
                                    <td>{stat.month_name}</td>
                                    <td className="text-right font-mono font-bold text-primary">{stat.qte_v}</td>
                                    <td className="text-right font-mono text-warning">{stat.qte_c}</td>
                                    <td className="text-right font-mono text-info">{stat.nb_c}</td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                        <div className="mt-2 text-[10px] text-base-content/50 flex justify-around">
                          <span>V = Vendue</span>
                          <span>C = Commandée</span>
                          <span>Nb = Nombre</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'mouvements' && (
                  <div className="overflow-x-auto">
                    {loadingHistory ? (
                      <div className="flex justify-center py-12">
                        <span className="loading loading-spinner loading-lg"></span>
                      </div>
                    ) : stockHistory.length === 0 ? (
                      <p className="text-center text-base-content/50 py-8">Aucun mouvement de stock enregistré</p>
                    ) : (
                      <table className="table table-sm">
                        <thead className="bg-base-200 sticky top-0">
                            <tr>
                              <th className="text-xs">Date</th>
                              <th className="text-xs">Type</th>
                              <th className="text-xs">Libellé</th>
                              <th className="text-xs">Opérateur</th>
                              <th className="text-xs text-right">Avant</th>
                              <th className="text-xs text-right">Qté</th>
                              <th className="text-xs text-right">Après</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stockHistory.map((item, index) => {
                              const isPositive = item.type === 'AJUSTEMENT' 
                                ? item.quantity > 0 
                                : ['ENTREE', 'RETOUR', 'TRANSFORMATION_ENTREE'].includes(item.type);
                              return (
                                <tr key={index} className="hover:bg-base-200/30">
                                  <td className="whitespace-nowrap text-xs font-mono">
                                    {new Date(item.date).toLocaleDateString('fr-FR')}
                                  </td>
                                  <td>
                                    <span className={`badge badge-xs font-medium ${
                                      item.type === 'AJUSTEMENT' 
                                        ? 'badge-warning text-warning-content'
                                        : isPositive ? 'badge-success text-white' : 'badge-error text-white'
                                    }`}>
                                      {item.type}
                                    </span>
                                  </td>
                                  <td className="max-w-[200px] truncate text-xs" title={item.libelle}>
                                    {item.libelle}
                                  </td>
                                  <td className="text-xs">{item.user_nom || '-'}</td>
                                  <td className="text-right font-mono text-xs">{item.stock_avant}</td>
                                  <td className={`text-right font-bold text-xs ${isPositive ? 'text-success' : 'text-error'}`}>
                                    {isPositive ? '+' : ''}{item.quantity}
                                  </td>
                                  <td className="text-right font-mono font-bold text-xs">{item.stock_apres}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10 text-center">
              <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <span className="text-3xl">📦</span>
              </div>
              <p className="font-bold text-slate-400">Aucun produit sélectionné</p>
              <p className="text-sm text-slate-300 mt-1 max-w-[200px]">Sélectionnez un produit dans la liste pour voir ses détails</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Détails Produit */}
      <dialog className={`modal ${isDetailsModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-3xl">
          <h3 className="font-bold text-lg mb-4">📦 Détails du Produit</h3>
          
          {selectedProduit && (
            <div className="space-y-4">
              {/* Info Card */}
              <div className="alert alert-info text-sm">
                <div className="w-full">
                  <div className="grid grid-cols-2 gap-2">
                    <div><strong>Nom:</strong> <span className="uppercase">{selectedProduit.name}</span></div>
                    <div><strong>Stock:</strong> <span className={`badge ${
                      (selectedProduit.stock ?? 0) <= 0 ? 'badge-error' :
                      (selectedProduit.stock ?? 0) <= (selectedProduit.stock_alert ?? 0) ? 'badge-warning' :
                      'badge-success'
                    }`}>{selectedProduit.stock ?? 0}</span></div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div role="tablist" className="tabs tabs-boxed">
                <a
                  role="tab"
                  className={`tab ${activeTab === 'general' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('general')}
                >
                  Général
                </a>
                <a
                  role="tab"
                  className={`tab ${activeTab === 'prix' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('prix')}
                >
                  Prix & Marge
                </a>
                <a
                  role="tab"
                  className={`tab ${activeTab === 'achats' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('achats')}
                >
                  Achats
                </a>
                <a
                  role="tab"
                  className={`tab ${activeTab === 'lots' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('lots')}
                >
                  Lots de stock
                </a>
                <a
                  role="tab"
                  className={`tab ${activeTab === 'ajustements' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('ajustements')}
                >
                  📝 Ajustements
                </a>
                <a
                  role="tab"
                  className={`tab ${activeTab === 'stats' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('stats')}
                >
                  📊 Stats Mensuelles
                </a>
              </div>

              {/* Contenu des tabs */}
              {activeTab === 'general' && (
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <tbody>
                      <tr>
                        <td className="font-semibold w-1/3">Description</td>
                        <td className="uppercase">{selectedProduit.description || '-'}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold">CIP1 / CIP2 / CIP3</td>
                        <td className="font-mono">{selectedProduit.cip1 || '-'} / {selectedProduit.cip2 || '-'} / {selectedProduit.cip3 || '-'}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold">Rayon</td>
                        <td><span className="badge badge-outline">{selectedProduit.rayon_name || '-'}</span></td>
                      </tr>
                      <tr>
                        <td className="font-semibold">Fournisseur</td>
                        <td><span className="badge badge-ghost">{selectedProduit.fournisseur_name || '-'}</span></td>
                      </tr>
                      <tr>
                        <td className="font-semibold">Stock min / max</td>
                        <td>{selectedProduit.stock_minimum ?? 0} / {selectedProduit.stock_maximum ?? 0}</td>
                      </tr>
                      <tr>
                        <td className="font-semibold">Seuil alerte</td>
                        <td><span className="badge badge-warning">{selectedProduit.stock_alert ?? 0}</span></td>
                      </tr>
                      <tr>
                        <td className="font-semibold">Date expiration</td>
                        <td>{selectedProduit.expire_date ? (() => {
                          const d = new Date(selectedProduit.expire_date);
                          return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
                        })() : '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'prix' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="stat bg-base-200/30 rounded-xl border border-base-200">
                    <div className="stat-title">Prix Revient</div>
                    <div className="stat-value text-blue-600 text-2xl">{Math.round(Number(selectedProduit.cost_price || 0)).toLocaleString('fr-FR')} F</div>
                  </div>
                  <div className="stat bg-primary text-primary-content rounded-xl">
                    <div className="stat-title text-primary-content/80">Prix Vente</div>
                    <div className="stat-value text-2xl">{Math.round(Number(selectedProduit.selling_price || 0)).toLocaleString('fr-FR')} F</div>
                  </div>
                  <div className="stat bg-base-200/30 rounded-xl border border-base-200">
                    <div className="stat-title">TVA</div>
                    <div className="stat-value text-xl">{selectedProduit.tva || '19.25'}%</div>
                  </div>
                  <div className="stat bg-base-200/30 rounded-xl border border-base-200">
                    <div className="stat-title">% Marge</div>
                    <div className="stat-value text-xl">{Number(selectedProduit.pourcentage_marge || 0).toFixed(2)}%</div>
                  </div>
                  <div className="stat bg-base-200/30 rounded-xl border border-base-200">
                    <div className="stat-title">Coef. Marge</div>
                    <div className="stat-value text-xl">{Number(selectedProduit.taux_marge || 0).toFixed(2)}</div>
                  </div>
                  <div className="stat bg-base-200/30 rounded-xl border border-base-200">
                    <div className="stat-title">Rotation Moy.</div>
                    <div className="stat-value text-xl">{Number(selectedProduit.rotation_moyenne || 0).toFixed(2)}<span className="text-sm"> /mois</span></div>
                  </div>
                </div>
              )}

              {activeTab === 'achats' && (
<div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Fournisseur</th>
                        <th className="text-right">Qté</th>
                        <th className="text-right">Prix</th>
                        <th>Lot</th>
                        <th>Expiration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {achats.length === 0 ? (
                        <tr><td colSpan={6} className="text-center text-base-content/50">Aucun achat enregistré</td></tr>
                      ) : (
                        achats.map(a => (
                          <tr key={a.id}>
                            <td className="font-mono text-xs">{a.commande_date?.slice(0, 10) || '-'}</td>
                            <td className="uppercase">{a.fournisseur_name || '-'}</td>
                            <td className="text-right font-bold">{a.quantity}</td>
                            <td className="text-right">{a.price} F</td>
                            <td className="font-mono text-xs">{a.lot || '-'}</td>
                            <td className="font-mono text-xs">{a.date_expiration ? (() => {
                              const d = new Date(a.date_expiration);
                              return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
                            })() : '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'lots' && (
                <div className="overflow-x-auto">
                  <table className="table table-xs">
                    <thead>
                      <tr>
                        <th>Numéro de lot</th>
                        <th>Date d'expiration</th>
                        <th className="text-right">Stock restant</th>
                        <th className="text-right">Prix de vente</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lots.length === 0 ? (
                        <tr><td colSpan={5} className="text-center text-base-content/50">Aucun lot disponible</td></tr>
                      ) : (
                        lots.map(lot => {
                          const expirationDate = lot.date_expiration ? new Date(lot.date_expiration) : null
                          const today = new Date()
                          const isExpired = expirationDate ? expirationDate < today : false
                          const monthsDiff = expirationDate 
                            ? (expirationDate.getFullYear() - today.getFullYear()) * 12 + expirationDate.getMonth() - today.getMonth()
                            : 999
                          const isExpiringSoon = monthsDiff <= 3 && monthsDiff >= 0
                          
                          return (
                            <tr key={lot.id} className={lot.quantity_remaining === 0 ? 'opacity-50' : ''}>
                              <td className="font-mono font-bold">{lot.lot || 'N/A'}</td>
                              <td>
                                {expirationDate ? (
                                  <span className={isExpired ? 'text-error font-bold' : isExpiringSoon ? 'text-warning font-semibold' : ''}>
                                    {`${(expirationDate.getMonth() + 1).toString().padStart(2, '0')}/${expirationDate.getFullYear().toString().slice(-2)}`}
                                    {isExpired && ' ⚠️ Expiré'}
                                    {isExpiringSoon && !isExpired && ' ⏰'}
                                  </span>
                                ) : 'N/A'}
                              </td>
                              <td className="text-right font-bold">
                                <span className={lot.quantity_remaining === 0 ? 'text-error' : 'text-success'}>
                                  {lot.quantity_remaining}
                                </span>
                              </td>
                              <td className="text-right">{lot.selling_price} F</td>
                              <td>
                                {lot.quantity_remaining === 0 ? (
                                  <span className="badge badge-error badge-sm">Épuisé</span>
                                ) : (
                                  <span className="badge badge-success badge-sm">Disponible</span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'ajustements' && (
                <div className="overflow-x-auto">
                  {adjustments.length === 0 ? (
                    <p className="text-center text-base-content/50 py-4">Aucun ajustement enregistré</p>
                  ) : (
                    <table className="table table-xs">
                      <thead>
                        <tr className="bg-base-200">
                          <th>Date</th>
                          <th>Utilisateur</th>
                          <th className="text-right">Avant</th>
                          <th className="text-right">Après</th>
                          <th className="text-center">Change</th>
                          <th>Motif</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adjustments.map(adj => (
                          <tr key={adj.id}>
                            <td className="text-xs">
                              {new Date(adj.created_at).toLocaleDateString('fr-FR')} {new Date(adj.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td>{adj.user_name || adj.username || '-'}</td>
                            <td className="text-right">{adj.quantity_before}</td>
                            <td className="text-right">{adj.quantity_after}</td>
                            <td className="text-center">
                              <span className={`badge badge-sm ${adj.quantity_change > 0 ? 'badge-success' : adj.quantity_change < 0 ? 'badge-error' : 'badge-ghost'}`}>
                                {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-outline badge-xs mr-1">{adj.reason_type_display}</span>
                              <span className="text-xs text-base-content/70">{adj.reason_detail}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'stats' && (
                <div className="overflow-x-auto max-h-96">
                  {monthlyStats.length === 0 ? (
                    <p className="text-center text-base-content/50 py-4">Aucune statistique disponible</p>
                  ) : (
                    <table className="table table-xs">
                      <thead className="bg-base-200 sticky top-0">
                        <tr>
                          <th className="text-xs uppercase"></th>
                          <th className="text-xs uppercase">Mois</th>
                          <th className="text-xs uppercase text-right text-primary">Qté V</th>
                          <th className="text-xs uppercase text-right text-warning">Qté C</th>
                          <th className="text-xs uppercase text-right text-info">Nb C</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let currentYear: number | null = null;
                          return monthlyStats.map((stat, index) => {
                            const showYear = stat.year !== currentYear;
                            currentYear = stat.year;
                            return (
                              <tr key={index} className={showYear ? 'border-t-2 border-base-300' : ''}>
                                <td className="font-bold text-base-content/60">
                                  {showYear ? stat.year : ''}
                                </td>
                                <td>{stat.month_name}</td>
                                <td className="text-right font-mono font-bold text-primary">
                                  {stat.qte_v}
                                </td>
                                <td className="text-right font-mono text-warning">
                                  {stat.qte_c}
                                </td>
                                <td className="text-right font-mono text-info">
                                  {stat.nb_c}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  )}
                  <div className="mt-3 text-xs text-base-content/50 flex justify-between">
                    <span>Qté V = Quantité Vendue</span>
                    <span>Qté C = Quantité Commandée</span>
                    <span>Nb C = Nombre de Commandes</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="modal-action">
            <button
              className="btn btn-sm btn-warning"
              onClick={handleOpenAdjustmentModal}
            >
              📊 Ajuster Stock
            </button>
            <button
              className="btn btn-sm btn-primary"
              onClick={() => selectedProduit && handleOpenEditModal(selectedProduit)}
            >
              ✏️ Modifier
            </button>
            <button
              className="btn btn-sm btn-error text-white"
              onClick={() => selectedProduit && handleDeleteProduit(selectedProduit)}
            >
              🗑️ Supprimer
            </button>
            <button className="btn btn-sm" onClick={() => setIsDetailsModalOpen(false)}>Fermer</button>
          </div>
        </div>
      </dialog>

      {/* Modal Édition Produit */}
      <dialog className={`modal ${isEditModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-2xl">
          <h3 className="font-bold text-lg mb-4">✏️ Modifier le Produit</h3>
          
          <form onSubmit={handleUpdateProduit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nom */}
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">Nom *</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  required
                />
              </div>

              {/* Stock */}
              {/* Stock (Lecture seule) */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Stock</span>
                  <span className="badge badge-sm badge-ghost">🔒 Sécurisé</span>
                </label>
                <div className="tooltip" data-tip="Pour la traçabilité, utilisez le bouton 'Ajuster Stock' dans les détails produit">
                    <input
                      type="number"
                      className="input input-bordered bg-base-200 text-base-content/60 w-full cursor-not-allowed font-bold"
                      value={editForm.stock}
                      readOnly
                      disabled
                    />
                </div>
                <label className="label">
                   <span className="label-text-alt text-info flex items-center gap-1">
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                     </svg>
                     Utilisez l'option <strong>Ajuster Stock</strong>
                   </span>
                </label>
              </div>

              {/* Prix de revient */}
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">Prix de revient (F) *</span></label>
                <input
                  type="number"
                  step="0.01"
                  className="input input-bordered"
                  value={editForm.cost_price}
                  onChange={(e) => setEditForm({...editForm, cost_price: e.target.value})}
                  required
                />
              </div>

              {/* Prix de vente */}
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">Prix de vente (F) *</span></label>
                <input
                  type="number"
                  step="0.01"
                  className="input input-bordered"
                  value={editForm.selling_price}
                  onChange={(e) => setEditForm({...editForm, selling_price: e.target.value})}
                  required
                />
              </div>

              {/* CIP1 */}
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">CIP1</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={editForm.cip1}
                  onChange={(e) => setEditForm({...editForm, cip1: e.target.value})}
                />
              </div>

              {/* CIP2 */}
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">CIP2</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={editForm.cip2}
                  onChange={(e) => setEditForm({...editForm, cip2: e.target.value})}
                />
              </div>

              {/* CIP3 */}
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">CIP3</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={editForm.cip3}
                  onChange={(e) => setEditForm({...editForm, cip3: e.target.value})}
                />
              </div>

              {/* TVA */}
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">TVA (%)</span></label>
                <input
                  type="number"
                  step="0.01"
                  className="input input-bordered"
                  value={editForm.tva}
                  onChange={(e) => setEditForm({...editForm, tva: e.target.value})}
                />
              </div>

              {/* Expiration */}
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">Date expiration</span></label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={editForm.expire_date}
                  onChange={(e) => setEditForm({...editForm, expire_date: e.target.value})}
                />
              </div>

              {/* Seuil alerte */}
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">Seuil alerte</span></label>
                <input
                  type="number"
                  className="input input-bordered"
                  value={editForm.stock_alert}
                  onChange={(e) => setEditForm({...editForm, stock_alert: e.target.value})}
                />
              </div>

              {/* Stock min */}
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">Stock minimum</span></label>
                <input
                  type="number"
                  className="input input-bordered"
                  value={editForm.stock_minimum}
                  onChange={(e) => setEditForm({...editForm, stock_minimum: e.target.value})}
                />
              </div>

              {/* Stock max */}
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">Stock maximum</span></label>
                <input
                  type="number"
                  className="input input-bordered"
                  value={editForm.stock_maximum}
                  onChange={(e) => setEditForm({...editForm, stock_maximum: e.target.value})}
                />
              </div>
            </div>


            {/* Gestion par lots */}
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-4">
                <input
                  type="checkbox"
                  checked={editForm.use_lot_management}
                  onChange={(e) => setEditForm({...editForm, use_lot_management: e.target.checked})}
                  className="checkbox checkbox-primary"
                />
                <div>
                  <span className="label-text font-semibold">Gestion par lots FIFO</span>
                  <p className="text-xs text-base-content/60 mt-1">
                    Activer la traçabilité par lots (recommandé pour médicaments, produits périssables)
                  </p>
                </div>
              </label>
            </div>

            {/* Rayon, Fournisseur et Forme */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="form-control">
                <label className="label"><span className="label-text font-semibold">Forme</span></label>
                <select
                  className="select select-bordered w-full"
                  value={editForm.forme}
                  onChange={(e) => setEditForm({...editForm, forme: e.target.value})}
                >
                  <option value="">Sélectionner</option>
                  {formes.map(f => (
                    <option key={f.id} value={f.id}>{f.nom}</option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">Rayon</span></label>
                <select
                  className="select select-bordered w-full"
                  value={editForm.rayon}
                  onChange={(e) => setEditForm({...editForm, rayon: e.target.value})}
                >
                  <option value="">Sélectionner un rayon</option>
                  {rayons
                    .filter(r => !r.parent) // Parents only first
                    .map(parent => (
                      <optgroup key={parent.id} label={parent.name}>
                        <option value={parent.id}>{parent.name}</option>
                        {rayons
                          .filter(child => child.parent === parent.id)
                          .map(child => (
                            <option key={child.id} value={child.id}>
                              &nbsp;&nbsp;&nbsp;↳ {child.name}
                            </option>
                          ))
                        }
                      </optgroup>
                    ))
                  }
                  {/* Orphelins (au cas où) */}
                  {rayons.some(r => r.parent && !rayons.find(p => p.id === r.parent)) && (
                     <optgroup label="Autres">
                       {rayons
                         .filter(r => r.parent && !rayons.find(p => p.id === r.parent))
                         .map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                       }
                     </optgroup>
                  )}
                </select>
              </div>

              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">Fournisseur</span></label>
                <select
                  className="select select-bordered w-full"
                  value={editForm.fournisseur}
                  onChange={(e) => setEditForm({...editForm, fournisseur: e.target.value})}
                >
                  <option value="">Sélectionner un fournisseur</option>
                  {fournisseurs.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <label className="label cursor-pointer justify-start gap-2 mt-1">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs checkbox-primary"
                    checked={editForm.is_supplier_exclusive}
                    onChange={(e) => setEditForm({...editForm, is_supplier_exclusive: e.target.checked})}
                    disabled={!editForm.fournisseur} 
                  />
                  <span className={`label-text-alt ${!editForm.fournisseur ? 'text-base-content/30' : ''}`}>
                    Exclusivité fournisseur
                  </span>
                </label>
              </div>
            </div>

            {/* Section Ordonnancier */}
            <div className="divider text-sm font-semibold text-base-content/50 uppercase tracking-wider">Ordonnance & Surveillance</div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-base-100 p-4 rounded-lg border border-base-200">
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-4">
                  <input 
                    type="checkbox" 
                    className="checkbox checkbox-primary" 
                    checked={editForm.requires_prescription || false}
                    onChange={(e) => setEditForm({...editForm, requires_prescription: e.target.checked})}
                  />
                  <span className="label-text font-medium">Nécessite une ordonnance</span>
                </label>
              </div>
              
              <div className="form-control w-full">
                <label className="label py-0 mb-1"><span className="label-text">Niveau de surveillance</span></label>
                <select 
                  className="select select-bordered select-sm w-full"
                  value={editForm.surveillance_category || 'NONE'}
                  onChange={(e) => setEditForm({...editForm, surveillance_category: e.target.value as any})}
                >
                  <option value="NONE">Aucune</option>
                  <option value="STANDARD">Surveillance Standard</option>
                  <option value="RENFORCEE">Surveillance Renforcée</option>
                </select>
              </div>
            </div>

            <div className="modal-action">
              <button type="button" className="btn btn-sm" onClick={() => setIsEditModalOpen(false)}>Annuler</button>
              <button type="submit" className="btn btn-sm btn-primary">💾 Enregistrer</button>
            </div>
          </form>
        </div>
      </dialog>

      {/* Modal Ajustement de Stock */}
      <dialog className={`modal ${isAdjustmentModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box max-w-md">
          <h3 className="font-bold text-lg mb-4">
            📊 Ajuster le stock
            {selectedProduit && <span className="text-base-content/70 ml-2">- {selectedProduit.name}</span>}
          </h3>
          
          <form onSubmit={handleStockAdjustment} className="space-y-4">
            <div className="alert alert-info py-2">
              <span>Stock actuel : <strong>{selectedProduit?.stock ?? 0}</strong> unités</span>
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Nouvelle quantité *</span>
              </label>
              <input
                type="number"
                className="input input-bordered input-sm"
                value={adjustmentForm.new_quantity}
                onChange={(e) => setAdjustmentForm(prev => ({ ...prev, new_quantity: e.target.value }))}
                required
                min={0}
              />
              {adjustmentForm.new_quantity && selectedProduit && (
                <label className="label">
                  <span className={`label-text-alt ${
                    parseInt(adjustmentForm.new_quantity) > selectedProduit.stock ? 'text-success' : 
                    parseInt(adjustmentForm.new_quantity) < selectedProduit.stock ? 'text-error' : ''
                  }`}>
                    Différence : {parseInt(adjustmentForm.new_quantity) - selectedProduit.stock > 0 ? '+' : ''}
                    {parseInt(adjustmentForm.new_quantity) - selectedProduit.stock}
                  </span>
                </label>
              )}
            </div>
            
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Type de motif *</span>
              </label>
              <select
                className="select select-bordered select-sm"
                value={adjustmentForm.reason_type}
                onChange={(e) => setAdjustmentForm(prev => ({ ...prev, reason_type: e.target.value }))}
                required
              >
                {STOCK_ADJUSTMENT_REASONS.map(reason => (
                  <option key={reason.value} value={reason.value}>{reason.label}</option>
                ))}
              </select>
            </div>
            
            <div className="modal-action">
              <button type="button" className="btn btn-sm" onClick={() => setIsAdjustmentModalOpen(false)}>
                Annuler
              </button>
              <button 
                type="submit" 
                className="btn btn-sm btn-warning"
                disabled={!adjustmentForm.new_quantity}
              >
                ✓ Confirmer l'ajustement
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setIsAdjustmentModalOpen(false)}>close</button>
        </form>
      </dialog>

      {/* Sudo Mode Password Modal */}
      <PasswordConfirmModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onConfirm={pendingAction}
        title={passwordModalConfig.title}
        message={passwordModalConfig.message}
      />

      {/* Modal Création Produit */}
      <ProduitCreateModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleProduitCreated}
        produitsEndpoint={produitsEndpoint}
        rayonsEndpoint={rayonsEndpoint}
        fournisseursEndpoint={fournisseursEndpoint}
        rayons={rayons}
        fournisseurs={fournisseurs}
        formes={formes}
        groupes={groupes}
      />
    </div>
  )
}
