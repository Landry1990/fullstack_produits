import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import type { Fournisseur, Rayon, ProduitModel, AchatProduit } from '../types'
import ProduitCreateModal from './ProduitFormModal'

export default function Produit() {
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
  const [selectedProduit, setSelectedProduit] = useState<ProduitModel | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'prix' | 'achats'>('general')
  const [isImporting, setIsImporting] = useState(false)
  
  // Formulaire d'édition
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
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
    fournisseur: ''
  })
  
  // Données complémentaires
  const [rayons, setRayons] = useState<Rayon[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [achats, setAchats] = useState<AchatProduit[]>([])

  const apiBaseUrl = useMemo(() => (import.meta.env.VITE_API_BASE_URL ?? ''), [])
  const produitsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/produits/` : '/api/produits/'
  const rayonsEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/categories/` : '/api/categories/'
  const fournisseursEndpoint = apiBaseUrl ? `${apiBaseUrl}/api/fournisseurs/` : '/api/fournisseurs/'

  useEffect(() => {
    fetchProduits()
    fetchRayonsAndFournisseurs()
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
    setSelectedProduit(produit)
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
  }

  const handleGenerateLabels = async (produit: ProduitModel) => {
    const quantityStr = prompt(`Nombre d'étiquettes pour ${produit.name} ?`, "1")
    if (!quantityStr) return
    
    const quantity = parseInt(quantityStr, 10)
    if (isNaN(quantity) || quantity <= 0) {
      alert("Quantité invalide")
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
      alert('Erreur lors de la génération des étiquettes')
    }
  }

  const handleDeleteProduit = async (produit: ProduitModel) => {
    if (!confirm(`Supprimer le produit "${produit.name}" ?`)) return
    
    try {
      await axios.delete(`${produitsEndpoint}${produit.id}/`)
      setProduits(prev => prev.filter(p => p.id !== produit.id))
      setIsDetailsModalOpen(false)
    } catch (err) {
      alert('Erreur lors de la suppression')
      console.error(err)
    }
  }

  const handleRecalculateRotation = async () => {
    if (!confirm("Voulez-vous recalculer la rotation moyenne pour TOUS les produits ? Cela peut prendre quelques secondes.")) return
    
    setLoading(true)
    try {
      const { data } = await axios.post<{message: string}>(`${produitsEndpoint}recalculate_rotation/`)
      alert(data.message)
      fetchProduits() // Rafraîchir la liste pour voir les nouvelles valeurs
    } catch (err) {
      alert('Erreur lors du recalcul')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenEditModal = (produit: ProduitModel) => {
    setEditForm({
      name: produit.name,
      description: produit.description || '',
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
      fournisseur: produit.fournisseur ? String(produit.fournisseur) : ''
    })
    setIsEditModalOpen(true)
  }

  const handleUpdateProduit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduit) return
    
    try {
      const payload = {
        name: editForm.name.trim().toUpperCase(),
        description: editForm.description.trim().toUpperCase(),
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
        fournisseur: editForm.fournisseur ? parseInt(editForm.fournisseur, 10) : undefined
      }
      
      const { data } = await axios.patch<ProduitModel>(`${produitsEndpoint}${selectedProduit.id}/`, payload)
      setProduits(prev => prev.map(p => p.id === data.id ? data : p))
      setSelectedProduit(data)
      setIsEditModalOpen(false)
    } catch (err) {
      alert('Erreur lors de la mise à jour')
      console.error(err)
    }
  }

  const handleProduitCreated = (produit: ProduitModel) => {
    setProduits(prev => [produit, ...prev])
    setIsCreateModalOpen(false)
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

      alert(resultMessage)
      
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
    <div className="h-full flex flex-col bg-base-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-white shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-base-content">📦 Gestion des Produits</h1>
          <p className="text-sm text-base-content/60 mt-1">Inventaire et détails</p>
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

      {/* Filtres */}
      <div className="px-6 py-4 bg-base-50 border-b border-base-200 shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Recherche */}
          <div className="md:col-span-2 form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase">Rechercher</span>
            </label>
            <input
              type="text"
              placeholder="Nom ou CIP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-bordered input-sm"
            />
          </div>
          
          {/* Filtre Rayon */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase">Rayon</span>
            </label>
            <select
              value={filterRayon}
              onChange={(e) => setFilterRayon(e.target.value)}
              className="select select-bordered select-sm"
            >
              <option value="">Tous</option>
              {rayons.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          
          {/* Filtre Fournisseur */}
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text text-xs font-bold uppercase">Fournisseur</span>
            </label>
            <select
              value={filterFournisseur}
              onChange={(e) => setFilterFournisseur(e.target.value)}
              className="select select-bordered select-sm"
            >
              <option value="">Tous</option>
              {fournisseurs.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
            </select>
          </div>
        </div>
        
        {/* Boutons d'action */}
        <div className="flex justify-between items-center mt-3">
          <div className="flex gap-2">
            <button className="btn btn-sm btn-primary" onClick={() => setIsCreateModalOpen(true)}>
              ➕ Créer Produit
            </button>
            <label className="btn btn-sm btn-secondary" htmlFor="csv-import-input">
              {isImporting ? <span className="loading loading-spinner loading-xs"></span> : '📄'}
              Import CSV
            </label>
            <input
              id="csv-import-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCsvImport}
              disabled={isImporting}
            />
          </div>
          {(searchQuery || filterRayon || filterFournisseur) && (
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => {
                setSearchQuery('')
                setFilterRayon('')
                setFilterFournisseur('')
              }}
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Badges Stats */}
      <div className="px-6 py-3 bg-white border-b border-base-200 shrink-0">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="badge badge-lg badge-ghost gap-2">
            📦 Total: <span className="font-bold">{totalProduits}</span>
          </div>
          <div className="badge badge-lg badge-warning gap-2">
            ⚠️ Stock Faible: <span className="font-bold">{lowStockCount}</span>
          </div>
          <div className="badge badge-lg badge-error gap-2">
            🚫 Rupture: <span className="font-bold">{outOfStockCount}</span>
          </div>
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

      {/* Tableau */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : filteredProduits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-base-content/40">
            <p className="text-lg">Aucun produit trouvé</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-base-200 overflow-hidden">
            <table className="table table-zebra w-full">
              <thead>
                <tr className="bg-base-200">
                  <th className="text-xs uppercase">Produit</th>
                  <th className="text-xs uppercase">CIP</th>
                  <th className="text-xs uppercase text-right">Prix Vente</th>
                  <th className="text-xs uppercase text-center">Stock</th>
                  <th className="text-xs uppercase">Rayon</th>
                  <th className="text-xs uppercase text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProduits.map((produit) => (
                  <tr
                    key={produit.id}
                    className="hover cursor-pointer"
                    onClick={() => handleViewDetails(produit)}
                  >
                    <td className="font-bold uppercase">{produit.name}</td>
                    <td className="font-mono text-sm">{produit.cip1 || '-'}</td>
                    <td className="text-right font-bold">
                      {Math.round(Number(produit.selling_price || 0)).toLocaleString('fr-FR')} F
                    </td>
                    <td className="text-center">
                      <span className={`badge badge-sm ${
                        (produit.stock ?? 0) <= 0 ? 'badge-error' :
                        (produit.stock ?? 0) <= (produit.stock_alert ?? 0) ? 'badge-warning' :
                        'badge-success'
                      }`}>
                        {produit.stock ?? 0}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-outline badge-sm">{produit.rayon_name || '-'}</span>
                    </td>
                    <td className="text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewDetails(produit)
                          }}
                          title="Voir détails"
                        >
                          👁️
                        </button>
                        <button
                          className="btn btn-xs btn-ghost"
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-base-200 bg-base-50 shrink-0">
        <p className="text-sm text-base-content/60">
          {filteredProduits.length} produit{filteredProduits.length > 1 ? 's' : ''} affiché{filteredProduits.length > 1 ? 's' : ''}
          {filteredProduits.length !== produits.length && ` sur ${produits.length} au total`}
        </p>
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
              </div>

              {/* Contenu des tabs */}
              {activeTab === 'general' && (
                <div className="overflow-x-auto">
                  <table className="table table-sm">
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
                        <td>{selectedProduit.expire_date || '-'}</td>
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
                  <table className="table table-sm">
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
                            <td className="font-mono text-xs">{a.date_expiration || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          
          <div className="modal-action">
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

            {/* Description */}
            <div className="form-control">
              <label className="label"><span className="label-text font-semibold">Description</span></label>
              <textarea
                className="textarea textarea-bordered"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({...editForm, description: e.target.value})}
              />
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

            <div className="modal-action">
              <button type="button" className="btn btn-sm" onClick={() => setIsEditModalOpen(false)}>Annuler</button>
              <button type="submit" className="btn btn-sm btn-primary">💾 Enregistrer</button>
            </div>
          </form>
        </div>
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
