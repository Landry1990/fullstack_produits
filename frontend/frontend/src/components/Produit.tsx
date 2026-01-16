
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useConfirm } from '../hooks/useConfirm';
import { useAuth } from '../context/AuthContext';
import PasswordConfirmModal from './PasswordConfirmModal';
import type { Fournisseur, Rayon, ProduitModel, AchatProduit, StockLot, StockAdjustment } from '../types'
import { STOCK_ADJUSTMENT_REASONS } from '../types'
import ProduitCreateModal from './ProduitFormModal'
import ImportProductsModal from './products/ImportProductsModal'

// Type pour les statistiques mensuelles
type MonthlyStat = {
  year: number
  month: number
  month_name: string
  qte_v: number
  qte_c: number
  nb_c: number
}

export default function Produit() {
  // Hook de confirmation
  const confirm = useConfirm()
  
  const { user } = useAuth();
  // État principal
  const [produits, setProduits] = useState<ProduitModel[]>([])
  const [loading, setLoading] = useState(false)
  const [detailsLoading, setDetailsLoading] = useState(false) // Copilot: added separate loading state
  const [error, setError] = useState<string | null>(null)
  
  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [filterRayon, setFilterRayon] = useState('')
  const [filterFournisseur, setFilterFournisseur] = useState('')

  // Debounce de la recherche (300ms) pour optimiser avec beaucoup de produits
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
      setPage(1) // Reset page on search change
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false)
  const [selectedProduit, setSelectedProduit] = useState<ProduitModel | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'prix' | 'achats' | 'lots' | 'ajustements' | 'stats'>('general')
  const [isImporting, setIsImporting] = useState(false)
  
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
    use_lot_management: true,  // Default to true
    requires_prescription: false,
    surveillance_category: 'NONE'
  })
  
  // Données complémentaires
  const [rayons, setRayons] = useState<Rayon[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [achats, setAchats] = useState<AchatProduit[]>([])
  const [lots, setLots] = useState<StockLot[]>([])
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([])
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStat[]>([])
  
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

  useEffect(() => {
    fetchProduits()
  }, [debouncedSearchQuery, page])
  
  useEffect(() => {
    fetchRayonsAndFournisseurs()
  }, [])

  // Auto-refresh when user returns to the page/tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // User returned to the tab - refresh product data
        fetchProduits()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const fetchProduits = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (debouncedSearchQuery) params.append('search', debouncedSearchQuery)
      if (page > 1) params.append('page', page.toString())

      const response = await axios.get(`${produitsEndpoint}?${params.toString()}`)
      
      // Robust pagination handling - always ensure we get an array
      let produitsData: ProduitModel[] = [];
      
      if (response.data) {
        if (Array.isArray(response.data)) {
          // Direct array response (no pagination)
          produitsData = response.data;
          setTotalCount(response.data.length)
          setTotalPages(1)
        } else if (response.data.results && Array.isArray(response.data.results)) {
          // Paginated response with results array
          produitsData = response.data.results;
          setTotalCount(response.data.count || 0)
          // Default DRF limit is usually 50 or 100, assuming 50 for calculation if not provided
          const count = response.data.count || 0
          const limit = produitsData.length > 0 ? (count > produitsData.length && page === 1 ? produitsData.length : 50) : 50 // Try to infer limit or default
          setTotalPages(Math.ceil(count / limit) || 1)
        } else {
          // Unexpected format - log and use empty array
          console.warn('Unexpected API response format:', response.data);
          produitsData = [];
          setTotalCount(0)
        }
      }
      
      setProduits(produitsData)
    } catch (err) {
      setError('Erreur lors du chargement des produits')
      console.error('Erreur:', err)
      setProduits([]) // Ensure state is always an array even on error
    } finally {
      setLoading(false)
    }
  }

  const fetchRayonsAndFournisseurs = async () => {
    try {
      const [rayonsRes, fournisseursRes] = await Promise.all([
        axios.get(rayonsEndpoint),
        axios.get(fournisseursEndpoint)
      ])
      
      // Robust extraction of arrays
      let rayonsData: Rayon[] = [];
      let fournisseursData: Fournisseur[] = [];
      
      if (rayonsRes.data) {
        if (Array.isArray(rayonsRes.data)) {
          rayonsData = rayonsRes.data;
        } else if (rayonsRes.data.results && Array.isArray(rayonsRes.data.results)) {
          rayonsData = rayonsRes.data.results;
        }
      }
      
      if (fournisseursRes.data) {
        if (Array.isArray(fournisseursRes.data)) {
          fournisseursData = fournisseursRes.data;
        } else if (fournisseursRes.data.results && Array.isArray(fournisseursRes.data.results)) {
          fournisseursData = fournisseursRes.data.results;
        }
      }
      
      setRayons(rayonsData)
      setFournisseurs(fournisseursData)
    } catch (err) {
      console.error('Erreur chargement rayons/fournisseurs:', err)
      // Ensure arrays on error
      setRayons([])
      setFournisseurs([])
    }
  }

  const handleViewDetails = async (produit: ProduitModel) => {
    // Only set list loading if we don't have the product details? No, we want list to stay stable.
    setDetailsLoading(true) 
    try {
      const { data: fullProduit } = await axios.get<ProduitModel>(`${produitsEndpoint}${produit.id}/`)
      setSelectedProduit(fullProduit)
      setActiveTab('general')
      
      // Charger l'historique d'achats
      try {
        const response = await axios.get(
          `${apiBaseUrl ? `${apiBaseUrl}/api/commande-produits/` : '/api/commande-produits/'}?produit=${produit.id}`
        )
        // Handle paginated response
        const achatsData: AchatProduit[] = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.results ?? []);
        setAchats(achatsData)
      } catch {
        setAchats([])
      }

      // Charger les lots de stock
      try {
        const stockLotsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/stock-lots/` : '/api/stock-lots/'
        const response = await axios.get(
          `${stockLotsEndpoint}?produit=${produit.id}&ordering=date_expiration`
        )
        const lotsData: StockLot[] = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.results ?? []);
        setLots(lotsData)
      } catch {
        setLots([])
      }

      // Charger l'historique des ajustements
      try {
        const adjustmentsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/stock-adjustments/` : '/api/stock-adjustments/'
        const response = await axios.get(
          `${adjustmentsEndpoint}?produit=${produit.id}&ordering=-created_at`
        )
        const adjustmentsData: StockAdjustment[] = Array.isArray(response.data) 
          ? response.data 
          : (response.data?.results ?? []);
        setAdjustments(adjustmentsData)
      } catch {
        setAdjustments([])
      }

      // Charger les statistiques mensuelles
      try {
        const response = await axios.get<MonthlyStat[]>(`${produitsEndpoint}${produit.id}/monthly_stats/`)
        setMonthlyStats(response.data)
      } catch {
        setMonthlyStats([])
      }
    } catch (err) {
      toast.error('Erreur lors du chargement des détails du produit')
      console.error(err)
    } finally {
      setDetailsLoading(false)
    }
  }

  const handleGenerateLabels = async (produit: ProduitModel) => {
    const quantityStr = prompt(`Nombre d'étiquettes pour ${produit.name} ?`, "1")
    if (!quantityStr) return
    
    const quantity = parseInt(quantityStr, 10)
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("Quantité invalide")
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
      toast.error('Erreur lors de la génération des étiquettes')
    }
  }

  const executeDeleteProduit = async (produitId: number) => {
    try {
      await axios.delete(`${produitsEndpoint}${produitId}/`)
      setProduits(prev => prev.filter(p => p.id !== produitId))
      setSelectedProduit(null)
      toast.success('Produit supprimé avec succès')
    } catch (err) {
      toast.error('Erreur lors de la suppression')
      console.error(err)
    }
  }

  const handleDeleteProduit = async (produit: ProduitModel) => {
    // Permission Check
    if (!user?.is_superuser && !user?.can_delete_product) {
        toast.error("Accès refusé : Vous n'avez pas la permission de supprimer des produits.")
        return
    }

    const confirmed = await confirm({
      title: 'Supprimer le produit',
      message: `Voulez-vous vraiment supprimer le produit "${produit.name}" ?\n\nCette action est irréversible.`,
      variant: 'danger',
      confirmText: 'Supprimer'
    })
    if (!confirmed) return
    
    // Trigger Password Modal
    setPasswordModalConfig({
        title: "Confirmer la suppression",
        message: "Cette action est sensible. Veuillez saisir votre mot de passe pour confirmer la suppression définitive de ce produit."
    })
    setPendingAction(() => () => executeDeleteProduit(produit.id))
    setIsPasswordModalOpen(true)
  }

  const handleRecalculateRotation = async () => {
    const confirmed = await confirm({
      title: 'Recalculer les rotations',
      message: 'Voulez-vous recalculer la rotation moyenne pour TOUS les produits ?\n\nCela peut prendre quelques secondes.',
      variant: 'info',
      confirmText: 'Recalculer'
    })
    if (!confirmed) return
    
    setLoading(true)
    try {
      const { data } = await axios.post<{message: string}>(`${produitsEndpoint}recalculate_rotation/`)
      toast.success(data.message)
      fetchProduits() // Rafraîchir la liste pour voir les nouvelles valeurs
    } catch (err) {
      toast.error('Erreur lors du recalcul')
      console.error(err)
    } finally {
      setLoading(false)
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
      use_lot_management: produit.use_lot_management ?? true,
      requires_prescription: produit.requires_prescription ?? false,
      surveillance_category: produit.surveillance_category || 'NONE'
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateProduit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduit) return
    
    try {
      const payload = {
        name: editForm.name.trim().toUpperCase(),
        description: '',
        stock: parseInt(editForm.stock || '0', 10),
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
        rayon: editForm.rayon ? parseInt(editForm.rayon, 10) : undefined,
        fournisseur: editForm.fournisseur ? parseInt(editForm.fournisseur, 10) : undefined,
        use_lot_management: editForm.use_lot_management,
        requires_prescription: editForm.requires_prescription || false,
        surveillance_category: editForm.surveillance_category || 'NONE'
      }
      
      const { data } = await axios.patch<ProduitModel>(`${produitsEndpoint}${selectedProduit.id}/`, payload)
      setProduits(prev => prev.map(p => p.id === data.id ? data : p))
      setSelectedProduit(data)
      setIsEditModalOpen(false)
    } catch (err) {
      toast.error('Erreur lors de la mise à jour')
      console.error(err)
    }
  }

  const handleProduitCreated = (produit: ProduitModel) => {
    setProduits(prev => [produit, ...prev])
    setIsCreateModalOpen(false)
  }

  const executeStockAdjustment = async () => {
    if (!selectedProduit) return

    try {
      const { data } = await axios.post(
        `${produitsEndpoint}${selectedProduit.id}/adjust_stock/`,
        {
          new_quantity: parseInt(adjustmentForm.new_quantity),
          reason_type: adjustmentForm.reason_type
        }
      )
      toast.success(`Stock ajusté: ${data.quantity_change >= 0 ? '+' : ''}${data.quantity_change}`)
      
      // Rafraîchir les données
      handleViewDetails(selectedProduit)
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
        toast.error("Accès refusé : Vous n'avez pas la permission d'ajuster le stock manuellement.")
        return
    }
    
    // Validation
    if (!adjustmentForm.new_quantity) {
      toast.error('Veuillez saisir la nouvelle quantité')
      return
    }
    
    // Trigger Password Modal directly (no confirm dialog needed as the modal acts as confirmation)
    setPasswordModalConfig({
        title: "Confirmer l'ajustement de stock",
        message: `Vous allez modifier manuellement le stock de "${selectedProduit.name}". Veuillez confirmer par mot de passe.`
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

  const handleCsvImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const importEndpoint = apiBaseUrl 
        ? `${apiBaseUrl}/api/produits-import/import_csv/` 
        : '/api/produits-import/import_csv/'

      const response = await axios.post(importEndpoint, formData,  {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const { created, updated, errors, message } = response.data

      let resultMessage = message
      if (errors && errors.length > 0) {
        resultMessage += `\n\nErreurs (${errors.length}):\n` + errors.slice(0, 5).join('\n')
        if (errors.length > 5) {
          resultMessage += `\n... et ${errors.length - 5} autres erreurs`
        }
      }

      toast.success(resultMessage)
      
      // Rafraîchir la liste
      if (created > 0 || updated > 0) {
        fetchProduits()
      }
    } catch (err: any) {
      console.error('Erreur import CSV:', err)
      let errorMsg = 'Erreur lors de l\'import CSV'
      if (err.response?.data?.error) {
        errorMsg = err.response.data.error
      }
      setError(errorMsg)
    } finally {
      setIsImporting(false)
      // Reset input
      event.target.value = ''
    }
  }

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
      title: 'Suppression groupée',
      message: `Supprimer ${selectedProductIds.length} produit(s) sélectionné(s) ?\n\nCette action est irréversible.`,
      variant: 'danger',
      confirmText: `Supprimer ${selectedProductIds.length} produit(s)`
    })
    if (!confirmed) return
    
    setLoading(true)
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []
    
    try {
      // Supprimer tous les produits sélectionnés un par un pour capturer les erreurs individuelles
      for (const id of selectedProductIds) {
        try {
          await axios.delete(`${produitsEndpoint}${id}/`)
          successCount++
        } catch (err: any) {
          errorCount++
          const produit = produits.find(p => p.id === id)
          const produitName = produit?.name || `#${id}`
          
          // Vérifier si c'est une erreur de contrainte de clé étrangère
          if (err.response?.status === 500 || err.response?.data?.detail?.includes('protected') || err.response?.data?.detail?.includes('referenced')) {
            errors.push(`${produitName}: utilisé dans des commandes ou factures`)
          } else {
            errors.push(`${produitName}: ${err.response?.data?.detail || 'erreur inconnue'}`)
          }
        }
      }
      
      // Retirer les produits supprimés de la liste
      if (successCount > 0) {
        fetchProduits()
        setSelectedProductIds([])
      }
      
      // Afficher les résultats
      if (successCount > 0 && errorCount === 0) {
        toast.success(`${successCount} produit(s) supprimé(s) avec succès`)
      } else if (successCount > 0 && errorCount > 0) {
        toast(`${successCount} supprimé(s), ${errorCount} échec(s)`, { icon: '⚠️', duration: 5000 })
        errors.forEach(err => toast.error(err, { duration: 6000 }))
      } else {
        toast.error('Aucun produit n\'a pu être supprimé')
        errors.forEach(err => toast.error(err, { duration: 6000 }))
      }
    } catch (err) {
      toast.error('Erreur lors de la suppression groupée')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkChangeRayon = async (rayonId: number) => {
    const rayonName = rayons.find(r => r.id === rayonId)?.name || 'sélectionné'
    const confirmed = await confirm({
      title: 'Changer le rayon',
      message: `Affecter ${selectedProductIds.length} produit(s) au rayon "${rayonName}" ?`,
      variant: 'info',
      confirmText: 'Confirmer'
    })
    if (!confirmed) return

    setLoading(true)
    let successCount = 0
    let errorCount = 0

    try {
      for (const id of selectedProductIds) {
        try {
          await axios.patch(`${produitsEndpoint}${id}/`, { rayon: rayonId })
          successCount++
        } catch {
          errorCount++
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} produit(s) mis à jour`)
        fetchProduits()
        setSelectedProductIds([])
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} échec(s)`)
      }
    } catch (err) {
      toast.error('Erreur lors de la mise à jour')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkChangeFournisseur = async (fournisseurId: number) => {
    const fournisseurName = fournisseurs.find(f => f.id === fournisseurId)?.name || 'sélectionné'
    const confirmed = await confirm({
      title: 'Changer le fournisseur',
      message: `Affecter ${selectedProductIds.length} produit(s) au fournisseur "${fournisseurName}" ?`,
      variant: 'info',
      confirmText: 'Confirmer'
    })
    if (!confirmed) return

    setLoading(true)
    let successCount = 0
    let errorCount = 0

    try {
      for (const id of selectedProductIds) {
        try {
          await axios.patch(`${produitsEndpoint}${id}/`, { fournisseur: fournisseurId })
          successCount++
        } catch {
          errorCount++
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} produit(s) mis à jour`)
        fetchProduits()
        setSelectedProductIds([])
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} échec(s)`)
      }
    } catch (err) {
      toast.error('Erreur lors de la mise à jour')
      console.error(err)
    } finally {
      setLoading(false)
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
    
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [produits, debouncedSearchQuery, filterRayon, filterFournisseur])

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

  // Safety check - if produits is somehow not an array, show loading
  if (!Array.isArray(produits)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary"></div>
          <p className="mt-4 text-base-content/70">Chargement des produits...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Header compact */}
      <div className="flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">📦 Gestion des Produits</h1>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleRecalculateRotation}
            className="btn btn-xs btn-ghost"
            disabled={loading}
            title="Recalculer la rotation"
          >
            🔄 Rotation
          </button>
          <button
            onClick={fetchProduits}
            className="btn btn-xs btn-ghost"
            disabled={loading}
            title="Actualiser"
          >
            {loading ? <span className="loading loading-spinner loading-xs"></span> : '🔄'}
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
                <h2 className="text-sm font-bold text-slate-800">Produits</h2>
                {loading ? (
                  <span className="loading loading-spinner loading-xs text-primary"></span>
                ) : (
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{filteredProduits.length}</span>
                )}
              </div>
              <div className="flex gap-1">
                <button 
                  className="btn btn-xs btn-ghost" 
                  onClick={() => setIsImporting(true)} 
                  title="Importer CSV/Excel"
                >
                  📄
                </button>
                {isImporting && (
                  <ImportProductsModal
                    onClose={() => setIsImporting(false)}
                    onSuccess={() => {
                      fetchProduits()
                      // Modal will auto-show success state, user manually closes it
                    }}
                  />
                )}
                <button className="btn btn-xs btn-primary" onClick={() => setIsCreateModalOpen(true)} title="Créer">
                  ➕
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
                placeholder="Nom ou CIP..."
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
                <option value="">Rayon</option>
                {rayons.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              <select
                value={filterFournisseur}
                onChange={(e) => setFilterFournisseur(e.target.value)}
                className="select select-xs select-bordered flex-1 min-w-0 text-xs h-7"
              >
                <option value="">Fournisseur</option>
                {fournisseurs.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
              </select>
              {(searchQuery || filterRayon || filterFournisseur) && (
                <button
                  className="btn btn-xs btn-ghost btn-square"
                  onClick={() => {
                    setSearchQuery('')
                    setFilterRayon('')
                    setFilterFournisseur('')
                  }}
                  title="Réinitialiser"
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
                <span className="text-xs mt-1">Aucun produit</span>
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
                            className={`text-xs uppercase ${
                              stock < 0 ? 'text-error font-bold' : 
                              stock === 0 ? 'text-slate-400 font-normal' : 
                              'text-slate-800 font-bold'
                            }`} 
                            title={produit.name}
                          >
                            {produit.name}
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
                <span>✓ {selectedProductIds.length} sélectionné(s)</span>
                <button 
                  className="btn btn-xs btn-ghost"
                  onClick={() => setSelectedProductIds([])}
                  title="Désélectionner"
                >
                  ✕
                </button>
              </div>
              <div className="flex gap-1 flex-wrap">
                <div className="dropdown dropdown-top dropdown-end">
                  <label tabIndex={0} className="btn btn-xs btn-outline btn-primary gap-1">
                    📁 Rayon ▼
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
                    🏭 Fournisseur ▼
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
                  🗑️ Supprimer
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
                      }`}>Stock: {selectedProduit.stock ?? 0}</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase">{selectedProduit.name}</h2>
                    <p className="text-sm text-slate-500 font-mono mt-1">
                      CIP: {selectedProduit.cip1 || '-'} / {selectedProduit.cip2 || '-'} / {selectedProduit.cip3 || '-'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button 
                      className="btn btn-sm btn-ghost text-slate-400 hover:text-warning" 
                      onClick={handleOpenAdjustmentModal}
                      title="Ajuster stock"
                    >
                      📊
                    </button>
                    <button 
                      className="btn btn-sm btn-ghost text-slate-400 hover:text-primary" 
                      onClick={() => handleOpenEditModal(selectedProduit)}
                      title="Modifier"
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn btn-sm btn-ghost text-slate-400 hover:text-secondary" 
                      onClick={() => handleGenerateLabels(selectedProduit)}
                      title="Étiquettes"
                    >
                      🏷️
                    </button>
                    <button 
                      className="btn btn-sm btn-ghost text-slate-400 hover:text-error" 
                      onClick={() => handleDeleteProduit(selectedProduit)}
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>

              {/* Onglets */}
              <div role="tablist" className="tabs tabs-boxed bg-slate-100 rounded-none px-4 pt-2 shrink-0">
                <a role="tab" className={`tab ${activeTab === 'general' ? 'tab-active' : ''}`} onClick={() => setActiveTab('general')}>
                  Général
                </a>
                <a role="tab" className={`tab ${activeTab === 'prix' ? 'tab-active' : ''}`} onClick={() => setActiveTab('prix')}>
                  Prix
                </a>
                <a role="tab" className={`tab ${activeTab === 'achats' ? 'tab-active' : ''}`} onClick={() => setActiveTab('achats')}>
                  Achats
                </a>
                <a role="tab" className={`tab ${activeTab === 'lots' ? 'tab-active' : ''}`} onClick={() => setActiveTab('lots')}>
                  Lots
                </a>
                <a role="tab" className={`tab ${activeTab === 'ajustements' ? 'tab-active' : ''}`} onClick={() => setActiveTab('ajustements')}>
                  Ajust.
                </a>
                <a role="tab" className={`tab ${activeTab === 'stats' ? 'tab-active' : ''}`} onClick={() => setActiveTab('stats')}>
                  Stats
                </a>
              </div>

              {/* Contenu des onglets */}
              <div className="flex-1 overflow-auto p-4">
                {activeTab === 'general' && (
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <tbody>
                        <tr>
                          <td className="font-semibold w-1/3">Description</td>
                          <td className="uppercase">{selectedProduit.description || '-'}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">Rayon</td>
                          <td><span className="badge badge-outline badge-sm">{selectedProduit.rayon_name || '-'}</span></td>
                        </tr>
                        <tr>
                          <td className="font-semibold">Fournisseur</td>
                          <td><span className="badge badge-ghost badge-sm">{selectedProduit.fournisseur_name || '-'}</span></td>
                        </tr>
                        <tr>
                          <td className="font-semibold">Stock min / max</td>
                          <td>{selectedProduit.stock_minimum ?? 0} / {selectedProduit.stock_maximum ?? 0}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">Seuil alerte</td>
                          <td><span className="badge badge-warning badge-sm">{selectedProduit.stock_alert ?? 0}</span></td>
                        </tr>
                        <tr>
                          <td className="font-semibold">Date expiration</td>
                          <td>{selectedProduit.expire_date ? (() => {
                            const d = new Date(selectedProduit.expire_date);
                            return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
                          })() : '-'}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">Dernier achat</td>
                          <td>{selectedProduit.dernier_achat ? new Date(selectedProduit.dernier_achat).toLocaleDateString('fr-FR') : '-'}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">Dernière vente</td>
                          <td>{selectedProduit.dernier_vente ? new Date(selectedProduit.dernier_vente).toLocaleDateString('fr-FR') : '-'}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">Gestion par lots</td>
                          <td>{selectedProduit.use_lot_management ? '✅ Activée' : '❌ Désactivée'}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">Ordonnance requise</td>
                          <td>{selectedProduit.requires_prescription ? '✅ Oui' : '❌ Non'}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold">Surveillance</td>
                          <td>{selectedProduit.surveillance_category === 'NONE' ? '-' : selectedProduit.surveillance_category}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'prix' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
                      <div className="stat-title text-sm">Prix Revient</div>
                      <div className="stat-value text-blue-600 text-xl">{Math.round(Number(selectedProduit.cost_price || 0)).toLocaleString('fr-FR')} F</div>
                    </div>
                    <div className="stat bg-primary text-primary-content rounded-xl p-4">
                      <div className="stat-title text-primary-content/80 text-sm">Prix Vente</div>
                      <div className="stat-value text-xl">{Math.round(Number(selectedProduit.selling_price || 0)).toLocaleString('fr-FR')} F</div>
                    </div>
                    <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
                      <div className="stat-title text-sm">TVA</div>
                      <div className="stat-value text-lg">{selectedProduit.tva || '19.25'}%</div>
                    </div>
                    <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
                      <div className="stat-title text-sm">% Marge</div>
                      <div className="stat-value text-lg">{Number(selectedProduit.pourcentage_marge || 0).toFixed(2)}%</div>
                    </div>
                    <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
                      <div className="stat-title text-sm">Coef. Marge</div>
                      <div className="stat-value text-lg">{Number(selectedProduit.taux_marge || 0).toFixed(2)}</div>
                    </div>
                    <div className="stat bg-base-200/30 rounded-xl border border-base-200 p-4">
                      <div className="stat-title text-sm">Rotation Moy.</div>
                      <div className="stat-value text-lg">{Number(selectedProduit.rotation_moyenne || 0).toFixed(2)}<span className="text-sm"> /mois</span></div>
                    </div>
                  </div>
                )}

                {activeTab === 'achats' && (
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Fournisseur</th>
                          <th className="text-right">Qté</th>
                          <th className="text-right">Prix</th>
                          <th>Lot</th>
                          <th>Exp.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {achats.length === 0 ? (
                          <tr><td colSpan={6} className="text-center text-base-content/50">Aucun achat enregistré</td></tr>
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
                          <th>Lot</th>
                          <th>Expiration</th>
                          <th className="text-right">Stock</th>
                          <th className="text-right">Prix</th>
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
                                    <span className="badge badge-error badge-xs">Épuisé</span>
                                  ) : (
                                    <span className="badge badge-success badge-xs">Dispo</span>
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
                      <table className="table table-sm">
                        <thead>
                          <tr className="bg-base-200">
                            <th>Date</th>
                            <th>User</th>
                            <th className="text-right">Avant</th>
                            <th className="text-right">Après</th>
                            <th className="text-center">Δ</th>
                            <th>Motif</th>
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
                      <p className="text-center text-base-content/50 py-4">Aucune statistique disponible</p>
                    ) : (
                      <>
                        <table className="table table-sm">
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
              <div className="form-control">
                <label className="label"><span className="label-text font-semibold">Stock *</span></label>
                <input
                  type="number"
                  className="input input-bordered"
                  value={editForm.stock}
                  onChange={(e) => setEditForm({...editForm, stock: e.target.value})}
                  required
                />
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

            {/* Rayon et Fournisseur */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      />
    </div>
  )
}
