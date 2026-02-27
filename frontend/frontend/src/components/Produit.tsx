
import { useState, useMemo, useEffect } from 'react' // Keep useEffect for scroll/focus management if needed, but remove data fetching ones
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from '../config/axios'
import { toast } from 'react-hot-toast'
import { useConfirm } from '../hooks/useConfirm';
import { useAuth } from '../context/AuthContext';
import PasswordConfirmModal from './PasswordConfirmModal';
import type { ProduitModel } from '../types'
import { STOCK_ADJUSTMENT_REASONS } from '../types'
import ProduitCreateModal from './ProduitFormModal'
import PremiumModal from './common/PremiumModal'

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
import { useTVA } from '../hooks/useTVA';

import { ProductDetailsModal as SalesDetailsModal } from './sales/modals/ProductDetailsModal';
import type { Facture } from '../types';

export default function Produit() {
  // Hook de confirmation
  const confirm = useConfirm()
  const navigate = useNavigate()
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tvaList } = useTVA();
  
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

  // Sales Modal State
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  const [loadingFacture, setLoadingFacture] = useState(false);

  
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

  // Handle Movement Click
  const handleMovementClick = async (item: any) => {
    if (item.facture && (item.type === 'SORTIE' || item.type === 'RETOUR')) {
      try {
        setLoadingFacture(true);
        setShowSalesModal(true);
        const response = await axios.get(`/api/factures/${item.facture}/`);
        setSelectedFacture(response.data);
      } catch (error) {
        console.error('Error fetching facture details:', error);
        toast.error('Erreur lors du chargement des détails de la facture');
        setShowSalesModal(false);
      } finally {
        setLoadingFacture(false);
      }
    } else if (item.commande) {
      // Pour les commandes, on redirige vers la page des commandes avec l'état pour ouvrir les détails
      navigate('/app/commandes', { state: { openDetailsId: item.commande } });
    }
  };

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
                                <tr 
                                  key={index} 
                                  className={`hover:bg-base-200/50 transition-colors ${(item.facture || item.commande) ? 'cursor-pointer' : ''}`}
                                  onClick={() => handleMovementClick(item)}
                                >
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
                                    <div className="flex items-center gap-1">
                                      {(item.facture || item.commande) && (
                                        <span className="text-primary" title={item.facture ? "Cliquez pour voir la facture" : "Cliquez pour voir la commande"}>🔍</span>
                                      )}
                                      {item.libelle}
                                      {item.commande_numero && (
                                        <span className="badge badge-ghost badge-xs font-mono ml-auto">
                                          {item.commande_numero}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="text-xs">{item.user || item.user_nom || '-'}</td>
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
      <PremiumModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        title={t('products.details.title') || "📦 Détails du Produit"}
        subtitle={selectedProduit?.name}
        maxWidth="max-w-4xl"
        icon={<span>📦</span>}
        gradientFrom="primary/10"
        gradientTo="secondary/10"
      >
        <div className="p-6">
          {selectedProduit && (
            <div className="space-y-6">
              {/* Info Card - Improved design */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-base-200/50 p-4 rounded-2xl border border-base-300 shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-base-content/50">CIP1</span>
                  <span className="font-mono font-bold text-primary">{selectedProduit.cip1 || '-'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-base-content/50">Stock Total</span>
                  <span className={`text-xl font-bold ${
                    (selectedProduit.stock ?? 0) <= 0 ? 'text-error' :
                    (selectedProduit.stock ?? 0) <= (selectedProduit.stock_alert ?? 0) ? 'text-warning' :
                    'text-success'
                  }`}>{selectedProduit.stock ?? 0}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-base-content/50">Rayon</span>
                  <span className="font-bold truncate" title={selectedProduit.rayon_name}>{selectedProduit.rayon_name || '-'}</span>
                </div>
              </div>

              {/* Tabs Navigation */}
              <div className="flex flex-wrap gap-1 bg-base-200 p-1 rounded-xl">
                {[
                  { id: 'general', label: 'Général', icon: '📋' },
                  { id: 'prix', label: 'Prix & Marge', icon: '💰' },
                  { id: 'achats', label: 'Achats', icon: '🛒' },
                  { id: 'lots', label: 'Lots', icon: '📦' },
                  { id: 'ajustements', label: 'Ajustements', icon: '📝' },
                  { id: 'stats', label: 'Stats', icon: '📊' },
                  { id: 'mouvements', label: 'Flux', icon: '🔄' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      activeTab === tab.id 
                      ? 'bg-white text-primary shadow-sm' 
                      : 'text-base-content/60 hover:text-base-content hover:bg-base-300'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content Container */}
              <div className="bg-white border border-base-200 rounded-2xl overflow-hidden min-h-[300px]">
                {activeTab === 'general' && (
                  <div className="p-4 overflow-x-auto">
                    <table className="table table-sm w-full">
                      <tbody>
                        <tr className="border-b border-base-100">
                          <td className="font-semibold text-base-content/60 py-3">Description</td>
                          <td className="uppercase font-medium">{selectedProduit.description || '-'}</td>
                        </tr>
                        <tr className="border-b border-base-100">
                          <td className="font-semibold text-base-content/60 py-3">CIP1 / CIP2 / CIP3</td>
                          <td className="font-mono text-primary">{selectedProduit.cip1 || '-'} / {selectedProduit.cip2 || '-'} / {selectedProduit.cip3 || '-'}</td>
                        </tr>
                        <tr className="border-b border-base-100">
                          <td className="font-semibold text-base-content/60 py-3">Fournisseur attitré</td>
                          <td>
                            <span className="badge badge-warning badge-sm font-bold uppercase">{selectedProduit.fournisseur_name || '-'}</span>
                            {selectedProduit.is_supplier_exclusive && <span className="ml-2 badge badge-error badge-xs text-white">Exclusif</span>}
                          </td>
                        </tr>
                        <tr className="border-b border-base-100">
                          <td className="font-semibold text-base-content/60 py-3">Stock min / max</td>
                          <td>
                             <span className="text-error font-bold">{selectedProduit.stock_minimum ?? 0}</span>
                             <span className="mx-2 text-base-content/30">/</span>
                             <span className="text-success font-bold">{selectedProduit.stock_maximum ?? 0}</span>
                          </td>
                        </tr>
                        <tr className="border-b border-base-100">
                          <td className="font-semibold text-base-content/60 py-3">Seuil alerte</td>
                          <td><span className="badge badge-error badge-sm font-bold">{selectedProduit.stock_alert ?? 0}</span></td>
                        </tr>
                        <tr>
                          <td className="font-semibold text-base-content/60 py-3">Date expiration</td>
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
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-base-100 p-4 rounded-2xl border border-base-200">
                      <div className="text-xs font-bold text-base-content/40 uppercase mb-1">Prix de Revient</div>
                      <div className="text-2xl font-black text-slate-700">{Math.round(Number(selectedProduit.cost_price || 0)).toLocaleString('fr-FR')} F</div>
                    </div>
                    <div className="bg-primary/5 p-4 rounded-2xl border border-primary/20">
                      <div className="text-xs font-bold text-primary/60 uppercase mb-1">Prix de Vente</div>
                      <div className="text-2xl font-black text-primary">{Math.round(Number(selectedProduit.selling_price || 0)).toLocaleString('fr-FR')} F</div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
                       <div className="bg-base-200/50 p-4 rounded-xl border border-base-200">
                         <div className="text-xs font-bold text-base-content/40 uppercase mb-1">TVA</div>
                         <div className="text-xl font-bold">{selectedProduit.tva || '19.25'}%</div>
                       </div>
                       <div className="bg-base-200/50 p-4 rounded-xl border border-base-200">
                         <div className="text-xs font-bold text-base-content/40 uppercase mb-1">Rotation</div>
                         <div className="text-xl font-bold">{Number(selectedProduit.rotation_moyenne || 0).toFixed(2)}<span className="text-xs ml-1">v/mois</span></div>
                       </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 flex items-center justify-between p-4 bg-success/10 rounded-2xl border border-success/20">
                       <div>
                          <div className="text-xs font-bold text-success/60 uppercase mb-1">Marge Bénéficiaire</div>
                          <div className="text-3xl font-black text-success">{Number(selectedProduit.pourcentage_marge || 0).toFixed(1)}%</div>
                       </div>
                       <div className="text-right">
                          <div className="text-xs font-bold text-success/60 uppercase mb-1">Coeff.</div>
                          <div className="text-2xl font-bold text-success">x{Number(selectedProduit.taux_marge || 0).toFixed(2)}</div>
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === 'achats' && (
                  <div className="overflow-x-auto min-h-[300px]">
                    <table className="table table-xs table-pin-rows">
                      <thead>
                        <tr>
                          <th className="bg-base-100">Date</th>
                          <th className="bg-base-100">Fournisseur</th>
                          <th className="bg-base-100 text-right">Qté</th>
                          <th className="bg-base-100 text-right">P.A. HT</th>
                          <th className="bg-base-100">Lot</th>
                          <th className="bg-base-100">Exp.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {achats.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-12 text-base-content/40 italic">Aucun achat enregistré</td></tr>
                        ) : (
                          achats.map(a => (
                            <tr key={a.id} className="hover">
                              <td className="font-mono text-[10px]">{a.commande_date?.slice(0, 10) || '-'}</td>
                              <td className="uppercase text-xs font-medium">{a.fournisseur_name || '-'}</td>
                              <td className="text-right font-bold text-primary">{a.quantity}</td>
                              <td className="text-right text-xs">{a.price} F</td>
                              <td className="font-mono text-[10px] text-base-content/60">{a.lot || '-'}</td>
                              <td className="font-mono text-[10px]">{a.date_expiration ? (() => {
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
                  <div className="overflow-x-auto min-h-[300px]">
                    <table className="table table-xs table-pin-rows">
                      <thead>
                        <tr className="bg-base-100">
                          <th>Lot #</th>
                          <th>Expiration</th>
                          <th className="text-right">Reste</th>
                          <th className="text-right">P.V.</th>
                          <th>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lots.length === 0 ? (
                          <tr><td colSpan={5} className="text-center py-12 text-base-content/40 italic">Aucun lot en stock</td></tr>
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
                              <tr key={lot.id} className={`hover ${lot.quantity_remaining === 0 ? 'opacity-40 grayscale' : ''}`}>
                                <td className="font-mono font-black text-primary">{lot.lot || '---'}</td>
                                <td>
                                  {expirationDate ? (
                                    <div className="flex items-center gap-1">
                                      <span className={isExpired ? 'badge badge-error badge-xs text-white' : isExpiringSoon ? 'badge badge-warning badge-xs' : 'text-xs'}>
                                        {`${(expirationDate.getMonth() + 1).toString().padStart(2, '0')}/${expirationDate.getFullYear().toString().slice(-2)}`}
                                      </span>
                                      {isExpired && <span className="text-[10px] text-error font-bold italic">EXPIRÉ</span>}
                                    </div>
                                  ) : '---'}
                                </td>
                                <td className="text-right font-bold">
                                  <span className={lot.quantity_remaining === 0 ? 'text-error' : 'text-success'}>
                                    {lot.quantity_remaining}
                                  </span>
                                </td>
                                <td className="text-right text-xs">{lot.selling_price} F</td>
                                <td>
                                  {lot.quantity_remaining === 0 ? (
                                    <span className="badge badge-ghost badge-xs">Vidé</span>
                                  ) : (
                                    <span className="badge badge-success badge-xs text-white">Actif</span>
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
                  <div className="overflow-x-auto min-h-[300px]">
                    {adjustments.length === 0 ? (
                      <p className="text-center py-12 text-base-content/40 italic">Aucun ajustement manuel</p>
                    ) : (
                      <table className="table table-xs table-pin-rows">
                        <thead>
                          <tr className="bg-base-100">
                             <th>Date</th>
                             <th>Auteur</th>
                             <th className="text-right">Diff.</th>
                             <th className="text-right">Final</th>
                             <th>Motif</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adjustments.map(adj => (
                            <tr key={adj.id} className="hover">
                              <td className="text-[10px] font-mono">
                                {new Date(adj.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} 
                                <span className="opacity-50 ml-1">{new Date(adj.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </td>
                              <td className="text-[10px] uppercase">{adj.user_name || adj.username || '-'}</td>
                              <td className="text-right">
                                <span className={`font-bold ${adj.quantity_change > 0 ? 'text-success' : 'text-error'}`}>
                                  {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
                                </span>
                              </td>
                              <td className="text-right font-black">{adj.quantity_after}</td>
                              <td>
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold">{adj.reason_type_display}</span>
                                  <span className="text-[9px] opacity-60 truncate max-w-[150px]">{adj.reason_detail}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === 'stats' && (
                  <div className="p-4 min-h-[300px]">
                    {monthlyStats.length === 0 ? (
                      <p className="text-center py-12 text-base-content/40 italic">Données statistiques insuffisantes</p>
                    ) : (
                      <table className="table table-xs w-full">
                        <thead className="bg-base-100">
                          <tr>
                            <th className="text-[10px]">Période</th>
                            <th className="text-right text-primary">Ventes</th>
                            <th className="text-right text-warning">Commandes</th>
                            <th className="text-right text-info">Nb. Cmd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyStats.slice(0, 12).map((stat, index) => (
                            <tr key={index} className="hover border-b border-base-50">
                              <td className="font-bold text-xs">{stat.month_name} {stat.year}</td>
                              <td className="text-right font-mono font-bold text-primary">{stat.qte_v}</td>
                              <td className="text-right font-mono text-warning/70">{stat.qte_c}</td>
                              <td className="text-right font-mono text-info/70">{stat.nb_c}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === 'mouvements' && (
                  <div className="overflow-x-auto min-h-[300px]">
                    {loadingHistory ? (
                      <div className="flex justify-center py-12"><span className="loading loading-spinner text-primary"></span></div>
                    ) : stockHistory.length === 0 ? (
                      <p className="text-center py-12 text-base-content/40 italic">Historique vide</p>
                    ) : (
                      <table className="table table-xs table-pin-rows">
                        <thead>
                            <tr className="bg-base-100">
                              <th>Date</th>
                              <th>Action</th>
                              <th>LIBELLÉ / DOC</th>
                              <th className="text-right">VAR.</th>
                              <th className="text-right">STOCK</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stockHistory.map((item, index) => {
                              const isPositive = item.type === 'AJUSTEMENT' 
                                ? item.quantity > 0 
                                : ['ENTREE', 'RETOUR', 'TRANSFORMATION_ENTREE'].includes(item.type);
                              return (
                                <tr 
                                  key={index} 
                                  className={`hover ${(item.facture || item.commande) ? 'cursor-pointer active:bg-base-200' : ''}`}
                                  onClick={() => handleMovementClick(item)}
                                >
                                  <td className="text-[9px] font-mono opacity-60">
                                    {new Date(item.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                                  </td>
                                  <td>
                                    <span className={`text-[8px] px-1 rounded uppercase font-bold border ${
                                      item.type === 'AJUSTEMENT' ? 'border-warning text-warning' :
                                      isPositive ? 'border-success text-success' : 'border-error text-error'
                                    }`}>
                                      {item.type}
                                    </span>
                                  </td>
                                  <td className="max-w-[120px] truncate text-[10px]" title={item.libelle}>
                                    <div className="flex items-center gap-1 font-medium">
                                      {(item.facture || item.commande) && <span className="text-primary">📄</span>}
                                      {item.libelle}
                                    </div>
                                  </td>
                                  <td className={`text-right font-bold text-xs ${isPositive ? 'text-success' : 'text-error'}`}>
                                    {isPositive ? '+' : ''}{item.quantity}
                                  </td>
                                  <td className="text-right font-mono font-bold text-xs bg-base-50">{item.stock_apres}</td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-base-200">
                <div className="flex gap-2">
                  <button
                    className="btn btn-warning btn-sm shadow-sm"
                    onClick={handleOpenAdjustmentModal}
                  >
                    📊 Ajuster Stock
                  </button>
                  <button
                    className="btn btn-primary btn-sm shadow-sm"
                    onClick={() => selectedProduit && handleOpenEditModal(selectedProduit)}
                  >
                    ✏️ Modifier
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn btn-ghost btn-sm text-error"
                    onClick={() => selectedProduit && handleDeleteProduit(selectedProduit)}
                  >
                    🗑️ Supprimer
                  </button>
                  <button className="btn btn-neutral btn-sm px-8" onClick={() => setIsDetailsModalOpen(false)}>Fermer</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </PremiumModal>


      {/* Modal Édition Produit */}
      <PremiumModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="✏️ Modifier le Produit"
        subtitle={editForm.name}
        maxWidth="max-w-4xl"
        icon={<span>✏️</span>}
        gradientFrom="warning/20"
        gradientTo="primary/20"
      >
        <form className="p-6 space-y-6" onSubmit={handleUpdateProduit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-bold uppercase tracking-wider text-base-content/50 border-b pb-2">Informations Générales</h4>
              <label className="form-control w-full">
                <div className="label"><span className="label-text font-semibold">Nom du produit *</span></div>
                <input
                  type="text"
                  className="input input-bordered w-full focus:input-primary"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                 <label className="form-control w-full">
                    <div className="label"><span className="label-text font-semibold">CIP1</span></div>
                    <input className="input input-bordered w-full font-mono" value={editForm.cip1}
                      onChange={(e) => setEditForm({ ...editForm, cip1: e.target.value })} />
                 </label>
                 <label className="form-control w-full">
                    <div className="label"><span className="label-text font-semibold text-xs">Rayon</span></div>
                    <select className="select select-bordered w-full" value={editForm.rayon}
                       onChange={(e) => setEditForm({ ...editForm, rayon: e.target.value })}>
                       <option value="">Sélectionner un rayon</option>
                       {rayons
                         .filter(r => !r.parent)
                         .map(parent => (
                           <optgroup key={parent.id} label={parent.name}>
                             <option value={parent.id}>{parent.name}</option>
                             {rayons
                               .filter(child => child.parent === parent.id)
                               .map(child => (
                                 <option key={child.id} value={child.id}>
                                   ↳ {child.name}
                                 </option>
                               ))
                             }
                           </optgroup>
                         ))
                       }
                    </select>
                 </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <label className="form-control w-full">
                    <div className="label"><span className="label-text font-semibold">Alerte stock</span></div>
                    <input type="number" className="input input-bordered w-full" value={editForm.stock_alert}
                      onChange={(e) => setEditForm({ ...editForm, stock_alert: e.target.value })} />
                 </label>
                 <label className="form-control w-full">
                    <div className="label"><span className="label-text font-semibold">Fournisseur</span></div>
                    <select className="select select-bordered w-full" value={editForm.fournisseur}
                       onChange={(e) => {
                         const val = e.target.value;
                         setEditForm({ 
                           ...editForm, 
                           fournisseur: val,
                           is_supplier_exclusive: val ? editForm.is_supplier_exclusive : false
                         });
                       }}>
                       <option value="">—</option>
                       {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                 </label>
              </div>
            </div>

            <div className="space-y-4">
               <h4 className="text-sm font-bold uppercase tracking-wider text-base-content/50 border-b pb-2">Prix et Marge</h4>
               <div className="grid grid-cols-2 gap-4">
                  <label className="form-control w-full">
                    <div className="label"><span className="label-text font-semibold">Prix Revient</span></div>
                    <div className="join w-full">
                      <input type="number" className="input input-bordered join-item w-full" value={editForm.cost_price}
                        onChange={(e) => setEditForm({ ...editForm, cost_price: e.target.value })} />
                      <span className="join-item btn btn-disabled bg-base-200">F</span>
                    </div>
                  </label>
                  <label className="form-control w-full">
                    <div className="label"><span className="label-text font-semibold text-primary">Prix Vente</span></div>
                    <div className="join w-full">
                      <input type="number" className="input input-bordered join-item w-full font-bold text-primary" value={editForm.selling_price}
                        onChange={(e) => setEditForm({ ...editForm, selling_price: e.target.value })} />
                      <span className="join-item btn btn-disabled bg-base-200">F</span>
                    </div>
                  </label>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <label className="form-control w-full">
                    <div className="label"><span className="label-text font-semibold">TVA (%)</span></div>
                    <select
                      className="select select-bordered w-full"
                      value={editForm.tva}
                      onChange={(e) => setEditForm({ ...editForm, tva: e.target.value })}
                    >
                      {tvaList.map(t => <option key={t.id} value={t.taux}>{t.taux}%</option>)}
                      {!tvaList.find(t => t.taux === editForm.tva) && (
                        <option value={editForm.tva}>{editForm.tva}%</option>
                      )}
                    </select>
                  </label>
                  <label className="form-control w-full">
                    <div className="label"><span className="label-text font-semibold">Expiration</span></div>
                    <input type="date" className="input input-bordered w-full" value={editForm.expire_date}
                      onChange={(e) => setEditForm({ ...editForm, expire_date: e.target.value })} />
                  </label>
               </div>

               <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-4 p-4 rounded-xl border bg-base-100">
                    <input type="checkbox" className="checkbox checkbox-primary" checked={editForm.use_lot_management}
                      onChange={(e) => setEditForm({...editForm, use_lot_management: e.target.checked})} />
                    <div>
                      <span className="label-text font-bold">Gestion par lots FIFO</span>
                      <p className="text-[10px] opacity-60">Recommandé pour médicaments et produits périssables</p>
                    </div>
                  </label>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border bg-info/5 border-info/20">
                <label className="label cursor-pointer justify-start gap-4">
                  <input type="checkbox" className="checkbox checkbox-primary" checked={editForm.requires_prescription || false}
                    onChange={(e) => setEditForm({ ...editForm, requires_prescription: e.target.checked })} />
                  <span className="label-text font-bold">Ordonnance Requise</span>
                </label>
              </div>
              <div className={`p-4 rounded-xl border transition-all ${editForm.fournisseur ? 'bg-warning/5 border-warning/20' : 'bg-base-200 opacity-50'}`}>
                <label className="label cursor-pointer justify-start gap-4">
                  <input type="checkbox" className="checkbox checkbox-warning" checked={editForm.is_supplier_exclusive} 
                    disabled={!editForm.fournisseur}
                    onChange={(e) => setEditForm({ ...editForm, is_supplier_exclusive: e.target.checked })} />
                  <span className="label-text font-bold">Exclusivité Fournisseur</span>
                </label>
              </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-base-200">
            <button type="button" className="btn btn-ghost px-8" onClick={() => setIsEditModalOpen(false)}>Annuler</button>
            <button type="submit" className="btn btn-primary px-10 shadow-lg shadow-primary/20">💾 Enregistrer</button>
          </div>
        </form>
      </PremiumModal>

      {/* Modal Ajustement de Stock */}
      <PremiumModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        title="Ajuster le stock"
        subtitle={selectedProduit?.name}
        maxWidth="max-w-md"
        icon={<span>📊</span>}
        gradientFrom="info/20"
        gradientTo="primary/20"
      >
        <form className="p-6 space-y-6" onSubmit={handleStockAdjustment}>
          <div className="bg-info/10 p-4 rounded-xl border border-info/20 text-center">
            <span className="text-sm opacity-70">Stock actuel :</span>
            <div className="text-2xl font-black text-info">{selectedProduit?.stock ?? 0}</div>
          </div>
          
          <div className="space-y-4">
            <label className="form-control w-full">
              <div className="label"><span className="label-text font-bold">Nouvelle quantité *</span></div>
              <input
                type="number"
                className="input input-bordered w-full text-center text-xl font-bold focus:input-primary"
                value={adjustmentForm.new_quantity}
                onChange={(e) => setAdjustmentForm(prev => ({ ...prev, new_quantity: e.target.value }))}
                required
                min={0}
              />
              {adjustmentForm.new_quantity && selectedProduit && (
                <div className="mt-2 text-center">
                  <span className={`badge badge-sm font-bold ${
                    parseInt(adjustmentForm.new_quantity) > selectedProduit.stock ? 'badge-success' : 
                    parseInt(adjustmentForm.new_quantity) < selectedProduit.stock ? 'badge-error' : 'badge-ghost'
                  }`}>
                    Différence : {parseInt(adjustmentForm.new_quantity) - selectedProduit.stock > 0 ? '+' : ''}
                    {parseInt(adjustmentForm.new_quantity) - selectedProduit.stock}
                  </span>
                </div>
              )}
            </label>
            
            <label className="form-control w-full">
              <div className="label"><span className="label-text font-bold">Type de motif *</span></div>
              <select
                className="select select-bordered w-full"
                value={adjustmentForm.reason_type}
                onChange={(e) => setAdjustmentForm(prev => ({ ...prev, reason_type: e.target.value }))}
                required
              >
                {STOCK_ADJUSTMENT_REASONS.map(reason => (
                  <option key={reason.value} value={reason.value}>{reason.label}</option>
                ))}
              </select>
            </label>
          </div>
          
          <div className="flex justify-end gap-3 pt-6 border-t border-base-200">
            <button type="button" className="btn btn-ghost px-8" onClick={() => setIsAdjustmentModalOpen(false)}>Annuler</button>
            <button type="submit" className="btn btn-warning px-10 shadow-lg shadow-warning/20 font-bold" disabled={!adjustmentForm.new_quantity}>
              ✓ Confirmer
            </button>
          </div>
        </form>
      </PremiumModal>

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
        rayons={rayons}
        fournisseurs={fournisseurs}
        formes={formes}
        groupes={groupes}
      />
      <SalesDetailsModal
        isOpen={showSalesModal}
        onClose={() => {
          setShowSalesModal(false);
          setSelectedFacture(null);
        }}
        facture={selectedFacture}
        loading={loadingFacture}
      />
    </div>
  )
}
