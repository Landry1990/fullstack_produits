import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import { useConfirm } from '../hooks/useConfirm'
import type { Fournisseur, Rayon, ProduitModel, AchatProduit, StockLot, StockAdjustment } from '../types'
import { STOCK_ADJUSTMENT_REASONS } from '../types'
import ProduitCreateModal from './ProduitFormModal'

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
  
  // État principal
  const [produits, setProduits] = useState<ProduitModel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Filtres
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRayon, setFilterRayon] = useState('')
  const [filterFournisseur, setFilterFournisseur] = useState('')

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

  const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL ?? ''), [])
  const produitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/produits/` : '/api/produits/'
  const rayonsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/categories/` : '/api/categories/'
  const fournisseursEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/fournisseurs/` : '/api/fournisseurs/'

  useEffect(() => {
    fetchProduits()
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
      const response = await axios.get(produitsEndpoint)
      
      // Robust pagination handling - always ensure we get an array
      let produitsData: ProduitModel[] = [];
      
      if (response.data) {
        if (Array.isArray(response.data)) {
          // Direct array response (no pagination)
          produitsData = response.data;
        } else if (response.data.results && Array.isArray(response.data.results)) {
          // Paginated response with results array
          produitsData = response.data.results;
        } else {
          // Unexpected format - log and use empty array
          console.warn('Unexpected API response format:', response.data);
          produitsData = [];
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
    setLoading(true)
    try {
      const { data: fullProduit } = await axios.get<ProduitModel>(`${produitsEndpoint}${produit.id}/`)
      setSelectedProduit(fullProduit)
      setActiveTab('general')
      setIsDetailsModalOpen(true)
      
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
      setLoading(false)
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

  const handleDeleteProduit = async (produit: ProduitModel) => {
    const confirmed = await confirm({
      title: 'Supprimer le produit',
      message: `Voulez-vous vraiment supprimer le produit "${produit.name}" ?\n\nCette action est irréversible.`,
      variant: 'danger',
      confirmText: 'Supprimer'
    })
    if (!confirmed) return
    
    try {
      await axios.delete(`${produitsEndpoint}${produit.id}/`)
      setProduits(prev => prev.filter(p => p.id !== produit.id))
      setIsDetailsModalOpen(false)
    } catch (err) {
      toast.error('Erreur lors de la suppression')
      console.error(err)
    }
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

  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduit) return
    
    // Validation
    if (!adjustmentForm.new_quantity) {
      toast.error('Veuillez saisir la nouvelle quantité')
      return
    }
    
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

  // Filtrer les produits
  const filteredProduits = useMemo(() => {
    // Ensure produits is always an array
    if (!Array.isArray(produits)) return [];
    
    let list = produits
    
    if (searchQuery) {
      const q = searchQuery.trim().toLowerCase()
      list = produits.filter(p => {
        const inName = p.name?.toLowerCase().includes(q)
        const inCips = [p.cip1, p.cip2, p.cip3].some(c => (c || '').toLowerCase().includes(q))
        return inName || inCips
      })
    }
    
    if (filterRayon) {
      list = list.filter(p => (p.rayon_name || '').toLowerCase() === filterRayon.toLowerCase())
    }
    
    if (filterFournisseur) {
      list = list.filter(p => (p.fournisseur_name || '').toLowerCase() === filterFournisseur.toLowerCase())
    }
    
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [produits, searchQuery, filterRayon, filterFournisseur])

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
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">📦 Gestion des Produits</h1>
          <p className="text-sm text-base-content/60">Inventaire et détails</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRecalculateRotation}
            className="btn btn-sm btn-ghost gap-2"
            disabled={loading}
            title="Recalculer la rotation moyenne de tous les produits"
          >
            🔄 Rotation
          </button>
          <button
            onClick={fetchProduits}
            className="btn btn-sm btn-ghost gap-2"
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner loading-xs"></span> : '🔄'}
            Actualiser
          </button>
        </div>
      </div>

      {/* Stats Badges */}
      <div className="flex flex-wrap gap-4 text-sm">
          <div className="badge badge-lg badge-ghost gap-2">
            📦 Total: <span className="font-bold">{totalProduits}</span>
          </div>
          <div className="badge badge-lg badge-warning gap-2">
            ⚠️ Faible: <span className="font-bold">{lowStockCount}</span>
          </div>
          <div className="badge badge-lg badge-error gap-2">
            🚫 Rupture: <span className="font-bold">{outOfStockCount}</span>
          </div>
      </div>

      {/* Filtres & Actions */}
      <div className="flex flex-col lg:flex-row gap-4 items-end">
          {/* Recherche */}
          <div className="form-control flex-1 w-full">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase text-gray-500">Rechercher</span>
            </label>
            <input
              type="text"
              placeholder="Nom ou CIP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
          </div>
          
          {/* Filtre Rayon */}
          <div className="form-control w-full lg:w-48">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase text-gray-500">Rayon</span>
            </label>
            <select
              value={filterRayon}
              onChange={(e) => setFilterRayon(e.target.value)}
              className="select select-bordered select-sm w-full"
            >
              <option value="">Tous</option>
              {rayons.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          
          {/* Filtre Fournisseur */}
          <div className="form-control w-full lg:w-48">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase text-gray-500">Fournisseur</span>
            </label>
            <select
              value={filterFournisseur}
              onChange={(e) => setFilterFournisseur(e.target.value)}
              className="select select-bordered select-sm w-full"
            >
              <option value="">Tous</option>
              {fournisseurs.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
            </select>
          </div>
          
          {/* Reset Button */}
           {(searchQuery || filterRayon || filterFournisseur) && (
            <button
              className="btn btn-sm btn-ghost btn-square mb-1"
              onClick={() => {
                setSearchQuery('')
                setFilterRayon('')
                setFilterFournisseur('')
              }}
              title="Réinitialiser filtres"
            >
              ✕
            </button>
          )}

          {/* Spacer for desktop */}
          <div className="hidden lg:block w-4"></div>

          {/* Boutons d'action */}
          <div className="flex gap-2">
            <label className="btn btn-sm btn-secondary" htmlFor="csv-import-input">
              {isImporting ? <span className="loading loading-spinner loading-xs"></span> : '📄'}
              Import
            </label>
            <input
              id="csv-import-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvImport}
              disabled={isImporting}
            />
            <button className="btn btn-sm btn-primary whitespace-nowrap" onClick={() => setIsCreateModalOpen(true)}>
              ➕ Créer
            </button>
            {selectedProductIds.length > 0 && (
              <button 
                className="btn btn-sm btn-error gap-2 whitespace-nowrap" 
                onClick={handleBulkDelete}
                disabled={loading}
              >
                🗑️ Supprimer ({selectedProductIds.length})
              </button>
            )}
          </div>
      </div>

      {/* Messages d'erreur */}
      {error && (
        <div className="px-6 pt-4 shrink-0">
          <div role="alert" className="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Tableau avec Footer intégré */}
      <div className="flex-1 min-h-0 bg-white rounded-lg shadow flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : filteredProduits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-base-content/40">
            <p className="text-lg">Aucun produit trouvé</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              <table className="table table-xs w-full table-pin-rows">
                <thead className="bg-base-200">
                  <tr>
                    <th className="w-12 bg-base-200">
                      <label>
                        <input
                          type="checkbox"
                          className="checkbox checkbox-xs"
                          checked={selectedProductIds.length === filteredProduits.length && filteredProduits.length > 0}
                          onChange={handleSelectAll}
                        />
                      </label>
                    </th>
                    <th className="text-xs uppercase bg-base-200">Produit</th>
                    <th className="text-xs uppercase bg-base-200">CIP</th>
                    <th className="text-xs uppercase text-right bg-base-200">Prix Vente</th>
                    <th className="text-xs uppercase text-center bg-base-200">Stock</th>
                    <th className="text-xs uppercase bg-base-200">Rayon</th>
                    <th className="text-xs uppercase text-center bg-base-200">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProduits.map((produit) => {
                    const stock = produit.stock ?? 0;
                    
                    const rowClass = stock < 0 
                      ? 'hover cursor-pointer text-error font-medium' // Stock négatif : rouge
                      : stock > 0 
                      ? 'hover cursor-pointer font-bold' // Stock positif : gras
                      : 'hover cursor-pointer text-base-content/70'; // Stock zero : normal (grisé)
                    
                    return (
                    <tr
                      key={produit.id}
                      className={rowClass}
                      onClick={() => handleViewDetails(produit)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <label>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs"
                            checked={selectedProductIds.includes(produit.id)}
                            onChange={() => handleSelectProduct(produit.id)}
                          />
                        </label>
                      </td>
                      <td className="uppercase">{produit.name}</td>
                      <td className="font-mono text-xs opacity-70">{produit.cip1 || '-'}</td>
                      <td className="text-right font-mono">
                        {Math.round(Number(produit.selling_price || 0)).toLocaleString('fr-FR')} F
                      </td>
                      <td className="text-center">
                        <span className={`badge badge-sm ${stock <= 0 ? (stock < 0 ? 'badge-error' : 'badge-ghost') : 'badge-success badge-outline'}`}>
                          {stock}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs opacity-70">{produit.rayon_name || '-'}</span>
                      </td>
                      <td className="text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            className="btn btn-xs btn-ghost btn-square"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewDetails(produit)
                            }}
                            title="Voir détails"
                          >
                            👁️
                          </button>
                          <button
                            className="btn btn-xs btn-ghost btn-square"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleGenerateLabels(produit)
                            }}
                            title="Étiquettes"
                          >
                            🏷️
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Footer compact */}
            <div className="p-2 border-t border-base-200 bg-base-50/50 text-xs text-center text-base-content/50">
                {filteredProduits.length} produit{filteredProduits.length > 1 ? 's' : ''} affiché{filteredProduits.length > 1 ? 's' : ''}
                {filteredProduits.length !== produits.length && ` sur ${produits.length} au total`}
            </div>
          </>
        )}
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
