import { useState, useEffect, useMemo, useCallback } from 'react'
import axios from 'axios'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Promis, ProduitModel, Client } from '../types'

export default function PromisPage() {
  const [promisList, setPromisList] = useState<Promis[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ATT' | 'DEL' | 'ANN'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Form states for new promis
  const [showForm, setShowForm] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [produits, setProduits] = useState<ProduitModel[]>([])
  const [formData, setFormData] = useState({
    client: null as number | null,
    client_name: '',
    client_phone: '',
    produit: null as number | null,
    quantite: 1,
    notes: ''
  })
  const [productSearch, setProductSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || ''
  const promisEndpoint = `${apiBaseUrl}/api/promis/`

  // Fetch promis list
  const fetchPromis = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(promisEndpoint)
      const results = Array.isArray(data) ? data : (data.results || [])
      setPromisList(results)
      setError(null)
    } catch (err) {
      setError('Erreur lors du chargement des promis')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [promisEndpoint])

  // Fetch clients and products for the form
  const fetchFormData = useCallback(async () => {
    try {
      const [clientsRes, produitsRes] = await Promise.all([
        axios.get(`${apiBaseUrl}/api/clients/`),
        axios.get(`${apiBaseUrl}/api/produits/`)
      ])
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : (clientsRes.data.results || []))
      setProduits(Array.isArray(produitsRes.data) ? produitsRes.data : (produitsRes.data.results || []))
    } catch (err) {
      console.error('Erreur chargement données formulaire', err)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    fetchPromis()
    fetchFormData()
  }, [fetchPromis, fetchFormData])

  // Filter and search
  const filteredPromis = useMemo(() => {
    let filtered = [...promisList]
    
    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(p => p.status === filterStatus)
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(p => 
        p.client_display.toLowerCase().includes(q) ||
        p.client_phone_display.toLowerCase().includes(q) ||
        p.produit_name.toLowerCase().includes(q) ||
        (p.produit_cip && p.produit_cip.toLowerCase().includes(q))
      )
    }
    
    return filtered
  }, [promisList, filterStatus, searchQuery])

  // Stats
  const stats = useMemo(() => ({
    total: promisList.length,
    enAttente: promisList.filter(p => p.status === 'ATT').length,
    delivres: promisList.filter(p => p.status === 'DEL').length,
    annules: promisList.filter(p => p.status === 'ANN').length
  }), [promisList])

  // Actions
  const handleDelivrer = async (id: number) => {
    if (!confirm('Marquer ce promis comme délivré ?')) return
    try {
      await axios.post(`${promisEndpoint}${id}/delivrer/`)
      fetchPromis()
    } catch (err) {
      alert('Erreur lors de la livraison')
      console.error(err)
    }
  }

  const handleAnnuler = async (id: number) => {
    if (!confirm('Annuler ce promis et réintégrer le stock ? Cette action créera une entrée dans l\'historique du produit.')) return
    try {
      const { data } = await axios.post(`${promisEndpoint}${id}/annuler_et_reintegrer/`)
      alert(data.detail)
      fetchPromis()
    } catch (err) {
      alert('Erreur lors de l\'annulation')
      console.error(err)
    }
  }

  const handlePrintTicket = async (id: number) => {
    try {
      const response = await axios.get(`${promisEndpoint}${id}/imprimer_ticket/`, {
        responseType: 'blob'
      })
      // Create a blob URL and open in new window
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
      // Revoke the URL after a delay to free memory
      setTimeout(() => window.URL.revokeObjectURL(url), 10000)
    } catch (err) {
      console.error('Erreur impression ticket:', err)
      alert('Erreur lors de l\'impression du ticket')
    }
  }

  // Form handling
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.produit) {
      alert('Veuillez sélectionner un produit')
      return
    }
    if (!formData.client && !formData.client_name.trim()) {
      alert('Veuillez sélectionner un client ou entrer un nom')
      return
    }

    setSaving(true)
    try {
      await axios.post(promisEndpoint, {
        ...formData,
        client: formData.client || null
      })
      setShowForm(false)
      setFormData({
        client: null,
        client_name: '',
        client_phone: '',
        produit: null,
        quantite: 1,
        notes: ''
      })
      setProductSearch('')
      setClientSearch('')
      fetchPromis()
    } catch (err) {
      alert('Erreur lors de la création du promis')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const selectProduct = (p: ProduitModel) => {
    setFormData(prev => ({ ...prev, produit: p.id }))
    setProductSearch(p.name)
  }

  const selectClient = (c: Client) => {
    setFormData(prev => ({ 
      ...prev, 
      client: c.id, 
      client_name: c.name,
      client_phone: c.phone 
    }))
    setClientSearch(c.name)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ATT': return 'badge badge-warning'
      case 'DEL': return 'badge badge-success'
      case 'ANN': return 'badge badge-error'
      default: return 'badge badge-ghost'
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Gestion des Promis</h1>
      
      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {/* Stats */}
      <div className="stats stats-vertical md:stats-horizontal shadow mb-6 w-full">
        <div className="stat">
          <div className="stat-title">Total</div>
          <div className="stat-value text-primary">{stats.total}</div>
        </div>
        <div className="stat cursor-pointer hover:bg-base-200" onClick={() => setFilterStatus('ATT')}>
          <div className="stat-title">En attente</div>
          <div className="stat-value text-warning">{stats.enAttente}</div>
        </div>
        <div className="stat cursor-pointer hover:bg-base-200" onClick={() => setFilterStatus('DEL')}>
          <div className="stat-title">Délivrés</div>
          <div className="stat-value text-success">{stats.delivres}</div>
        </div>
        <div className="stat cursor-pointer hover:bg-base-200" onClick={() => setFilterStatus('ANN')}>
          <div className="stat-title">Annulés</div>
          <div className="stat-value text-error">{stats.annules}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-4 mb-4 items-center justify-between">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Rechercher..."
            className="input input-bordered input-sm w-64"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <select 
            className="select select-bordered select-sm"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ATT">En attente</option>
            <option value="DEL">Délivrés</option>
            <option value="ANN">Annulés</option>
          </select>
        </div>
        <button 
          className="btn btn-primary btn-sm"
          onClick={() => setShowForm(true)}
        >
          + Nouveau Promis
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4">Nouveau Promis</h3>
            <form onSubmit={handleSubmit}>
              {/* Client search */}
              <div className="form-control mb-4">
                <label className="label"><span className="label-text">Client</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="Rechercher ou entrer le nom du client..."
                  value={clientSearch}
                  onChange={e => {
                    setClientSearch(e.target.value)
                    setFormData(prev => ({ ...prev, client: null, client_name: e.target.value }))
                  }}
                />
                {clientSearch && clients.filter(c => 
                  c.name.toLowerCase().includes(clientSearch.toLowerCase())
                ).slice(0, 5).map(c => (
                  <div 
                    key={c.id} 
                    className="p-2 hover:bg-base-200 cursor-pointer border-b"
                    onClick={() => selectClient(c)}
                  >
                    {c.name} - {c.phone}
                  </div>
                ))}
              </div>

              {/* Phone */}
              <div className="form-control mb-4">
                <label className="label"><span className="label-text">Téléphone</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="Numéro de téléphone"
                  value={formData.client_phone}
                  onChange={e => setFormData(prev => ({ ...prev, client_phone: e.target.value }))}
                />
              </div>

              {/* Product search */}
              <div className="form-control mb-4">
                <label className="label"><span className="label-text">Produit *</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  placeholder="Rechercher un produit..."
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value)
                    setFormData(prev => ({ ...prev, produit: null }))
                  }}
                />
                {productSearch && !formData.produit && produits.filter(p => 
                  p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                  (p.cip1 && p.cip1.includes(productSearch))
                ).slice(0, 5).map(p => (
                  <div 
                    key={p.id} 
                    className="p-2 hover:bg-base-200 cursor-pointer border-b"
                    onClick={() => selectProduct(p)}
                  >
                    {p.name} {p.cip1 && `(${p.cip1})`} - Stock: {p.stock}
                  </div>
                ))}
              </div>

              {/* Quantity */}
              <div className="form-control mb-4">
                <label className="label"><span className="label-text">Quantité *</span></label>
                <input
                  type="number"
                  min="1"
                  className="input input-bordered"
                  value={formData.quantite}
                  onChange={e => setFormData(prev => ({ ...prev, quantite: parseInt(e.target.value) || 1 }))}
                />
              </div>

              {/* Notes */}
              <div className="form-control mb-4">
                <label className="label"><span className="label-text">Notes</span></label>
                <textarea
                  className="textarea textarea-bordered"
                  placeholder="Notes optionnelles..."
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="modal-action">
                <button type="button" className="btn" onClick={() => setShowForm(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving && <span className="loading loading-spinner loading-sm" />}
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-8">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : filteredPromis.length === 0 ? (
            <div className="text-center text-base-content/60 py-8">
              Aucun promis trouvé
            </div>
          ) : (
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>Produit</th>
                  <th>Qté</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPromis.map(p => (
                  <tr key={p.id}>
                    <td>{format(new Date(p.date_promis), 'dd/MM/yyyy HH:mm', { locale: fr })}</td>
                    <td>{p.client_display}</td>
                    <td>{p.client_phone_display}</td>
                    <td>
                      <div>{p.produit_name}</div>
                      {p.produit_cip && <div className="text-xs text-base-content/60">{p.produit_cip}</div>}
                    </td>
                    <td className="font-bold">{p.quantite}</td>
                    <td>
                      <span className={getStatusBadge(p.status)}>{p.status_display}</span>
                    </td>
                    <td>
                      {p.status === 'ATT' && (
                        <div className="flex gap-1 flex-wrap">
                          <button 
                            className="btn btn-success btn-xs"
                            onClick={() => handleDelivrer(p.id)}
                            title="Marquer comme délivré"
                          >
                            ✓ Délivrer
                          </button>
                          <button 
                            className="btn btn-error btn-xs"
                            onClick={() => handleAnnuler(p.id)}
                            title="Annuler et réintégrer le stock"
                          >
                            ✕ Annuler
                          </button>
                          <button 
                            className="btn btn-info btn-xs"
                            onClick={() => handlePrintTicket(p.id)}
                            title="Imprimer ticket"
                          >
                            🖨️
                          </button>
                        </div>
                      )}
                      {p.status === 'DEL' && p.date_livraison && (
                        <span className="text-xs text-success">
                          Livré le {format(new Date(p.date_livraison), 'dd/MM/yyyy', { locale: fr })}
                        </span>
                      )}
                      {p.status === 'ANN' && (
                        <span className="text-xs text-error">Annulé</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
